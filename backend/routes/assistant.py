import os
import re
from datetime import datetime, timedelta, date
from typing import List, Tuple

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.models import Product, Customer, CreditEntry, Sale, User, EntryType
from schemas.schemas import AssistantQuery, AssistantResponse
from routes.auth import get_current_user_dep

router = APIRouter()
_context_cache: dict[int, Tuple[float, Tuple[List[Product], Tuple[float, float, int], Tuple[float, float], List[Tuple[str, float]]]]] = {}


def _shop_data(user: User, db: Session):
    """Cache shop data for 30 seconds to avoid repeated DB work."""
    now = datetime.now().timestamp()
    cached = _context_cache.get(user.id)
    if cached and now - cached[0] < 30:
        return cached[1]

    today_start = datetime.combine(date.today(), datetime.min.time())
    week_start = datetime.combine(date.today() - timedelta(days=6), datetime.min.time())

    products = db.query(Product).filter(Product.user_id == user.id).limit(200).all()
    sales_today = db.query(
        func.coalesce(func.sum(Sale.total_amount), 0.0),
        func.coalesce(func.sum(Sale.profit), 0.0),
        func.count(Sale.id),
    ).filter(Sale.user_id == user.id, Sale.created_at >= today_start).first()
    sales_week = db.query(
        func.coalesce(func.sum(Sale.total_amount), 0.0),
        func.coalesce(func.sum(Sale.profit), 0.0),
    ).filter(Sale.user_id == user.id, Sale.created_at >= week_start).first()
    pending = db.query(Customer.name, func.coalesce(func.sum(CreditEntry.remaining), 0.0)).join(
        CreditEntry, CreditEntry.customer_id == Customer.id
    ).filter(
        Customer.user_id == user.id,
        CreditEntry.remaining > 0,
        CreditEntry.entry_type == EntryType.CREDIT,
    ).group_by(Customer.name).order_by(func.sum(CreditEntry.remaining).desc()).limit(20).all()

    result = (products, sales_today, sales_week, pending)
    _context_cache[user.id] = (now, result)
    return result


def _nepali(text: str) -> bool:
    """Detect Devanagari characters to decide language."""
    return bool(re.search(r"[\u0900-\u097F]", text))


def _money(value: float) -> str:
    """Format a number as Rs. with commas."""
    return f"Rs.{value:,.0f}"


def _local_answer(
    question: str,
    user: User,
    products: List[Product],
    sales_today: Tuple[float, float, int],
    sales_week: Tuple[float, float],
    pending: List[Tuple[str, float]],
) -> str:
    """Keyword-based answer generator – no external AI."""
    q = question.lower().strip()
    ne = _nepali(question)

    # Greeting
    if any(w in q for w in ("hello", "hi", "namaste", "नमस्ते")):
        return (
            "नमस्ते! बिक्री, नाफा, स्टक, उत्पादन, वा बाँकी खाता सोध्नुहोस्।"
            if ne
            else "Hello! Ask about sales, profit, stock, products, or pending Khata."
        )

    # Profit
    if any(w in q for w in ("profit", "नाफा")):
        profit = sales_today[1]
        week_profit = sales_week[1]
        return (
            f"आजको नाफा {_money(profit)} हो। पछिल्लो ७ दिनमा {_money(week_profit)}।"
            if ne
            else f"Today's profit is {_money(profit)}. Last 7 days: {_money(week_profit)}."
        )

    # Today's sales
    if any(w in q for w in ("today", "आज")) and any(w in q for w in ("sale", "sales", "बिक्री")):
        total, _, count = sales_today
        return (
            f"आज {count} बिक्रीबाट {_money(total)} को कारोबार भयो।"
            if ne
            else f"Today: {_money(total)} from {count} sales."
        )

    # Weekly sales
    if any(w in q for w in ("week", "7 day", "७ दिन", "हप्ता")) and any(w in q for w in ("sale", "sales", "बिक्री")):
        total, _ = sales_week
        return (
            f"पछिल्लो ७ दिनको बिक्री {_money(total)} हो।"
            if ne
            else f"Last 7 days' sales: {_money(total)}."
        )

    # Low stock
    if any(w in q for w in ("low", "running low", "stock", "घट्दै", "स्टक")):
        low_items = [p for p in products if p.quantity <= p.low_stock_limit]
        if not low_items:
            return "सबै उत्पादन पर्याप्त स्टकमा छन्।" if ne else "All products are adequately stocked."
        lines = [
            f"• {p.name}: {p.quantity} बाँकी" if ne else f"• {p.name}: {p.quantity} left"
            for p in low_items
        ]
        return ("कम स्टक:\n" if ne else "Low stock:\n") + "\n".join(lines)

    # Pending Khata / credit
    if any(w in q for w in ("khata", "credit", "unpaid", "pending", "बाँकी", "उधारो", "खाता")):
        if not pending:
            return "कुनै बाँकी खाता छैन।" if ne else "There are no pending Khata balances."
        lines = [f"• {name}: {_money(amount)}" for name, amount in pending]
        return ("बाँकी खाता:\n" if ne else "Pending Khata:\n") + "\n".join(lines)

    # Expiry alerts
    if any(w in q for w in ("expiry", "expire", "मिति", "समाप्ति")):
        today = date.today()
        soon = [
            p for p in products
            if p.expiry_date and (p.expiry_date - today).days <= 7 and p.expiry_date >= today
        ]
        if not soon:
            return "अग्लो ७ दिनका भित्र कुनै पनि उत्पादन सम्पन्न हुन hain।" if ne else "No products expiring in the next 7 days."
        lines = [
            f"• {p.name}: expires {p.expiry_date}" if ne else f"• {p.name}: expires {p.expiry_date}"
            for p in soon[:10]
        ]
        return ("जल्द समाप्त हुन neo उत्पादन:\n" if ne else "Products expiring soon:\n") + "\n".join(lines)

    # Product search by keyword
    terms = [t for t in re.findall(r"\w+", q) if len(t) > 2]
    matches = [
        p for p in products
        if any(term in (p.name or "").lower() or term in (p.brand or "").lower() for term in terms)
    ]
    if matches:
        lines = [
            (
                f"• {p.name}: {_money(p.selling_price)}, स्टक {p.quantity}"
                + (f", र्याक {p.shelf_number}" if getattr(p, "shelf_number", None) else "")
                if ne
                else f"• {p.name}: {_money(p.selling_price)}, {p.quantity} in stock"
                + (f", shelf {p.shelf_number}" if getattr(p, "shelf_number", None) else "")
            )
            for p in matches[:10]
        ]
        return ("मिल्ने उत्पादन:\n" if ne else "Matching products:\n") + "\n".join(lines)

    # Stock level of a specific product
    if any(w in q for w in ("stock", "stok", "स्टक")) and terms:
        for p in products:
            if any(term in p.name.lower() or term in (p.brand or "").lower() for term in terms):
                status = "LOW" if p.quantity <= p.low_stock_limit else "OK"
                return (
                    f"{p.name} को स्टक {p.quantity} ({status}) हो।"
                    if ne
                    else f"{p.name} stock: {p.quantity} ({status})."
                )

    # Price inquiry
    if any(w in q for w in ("price", "किमत", "value", "cost")) and terms:
        for p in products:
            if any(term in p.name.lower() or term in (p.brand or "").lower() for term in terms):
                return (
                    f"{p.name} को विक्री मूल्य {_money(p.selling_price)} र cost {_money(p.buying_price)} छ।"
                    if ne
                    else f"{p.name} selling price: {_money(p.selling_price)}, cost: {_money(p.buying_price)}."
                )

    # Total products count
    if any(w in q for w in ("how many", "total", "count", "कति", "संख्या")) and any(
        w in q for w in ("product", "item", "सामान", "उत्पादन")
    ):
        return (
            f"तपाईंको pasalमा {len(products)} उत्पादन छन्।"
            if ne
            else f"You have {len(products)} products in your shop."
        )

    # Total customers count
    if any(w in q for w in ("how many", "total", "count", "कति", "संख्या")) and any(
        w in q for w in ("customer", "ग्राहक", "ग्राहिका")
    ):
        customer_count = db.query(Customer).filter(Customer.user_id == user.id).count()
        return (
            f"तपाईंको pasalमा {customer_count} ग्राहक छन्।"
            if ne
            else f"You have {customer_count} customers."
        )

    # Default fallback
    return (
        "म बिक्री, नाफा, कम स्टक, उत्पादन खोज, समाप्ति मिति, र बाँकी खाता मात्र देखाउन सक्छु। "
        "उदाहरण: ‘आजको नाफा’, ‘घट्दै गरेको स्टक’, ‘चाउचाउ खोज’, ‘किमत’, ‘expiry’।"
        if ne
        else "I can show sales, profit, low stock, product searches, expiry dates, and pending Khata. "
        "Try: ‘today profit’, ‘what is running low?’, ‘find noodles’, ‘price’, ‘expiry’."
    )


@router.post("/chat", response_model=AssistantResponse)
async def chat(
    data: AssistantQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    products, sales_today, sales_week, pending = _shop_data(current_user, db)
    return AssistantResponse(answer=_local_answer(data.query, current_user, products, sales_today, sales_week, pending))