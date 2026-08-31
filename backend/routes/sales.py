"""
Sales management routes for Kirana Smart Assistant.
Create sales, track daily/weekly summaries, and top products.
"""

from datetime import datetime, timedelta, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from database import get_db
from models.models import Sale, SaleItem, Product, Customer, CreditEntry, User, EntryType
from schemas.schemas import SaleCreate, SaleRead, SaleItemRead, DailySummary, WeeklySummary, TopProduct
from routes.auth import get_current_user_dep

router = APIRouter()


def _get_user_sales_query(db: Session, user_id: int):
    """Helper: base query for sales belonging to a user."""
    return db.query(Sale).filter(Sale.user_id == user_id)


@router.get("/today")
async def today_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get today's sales summary: total revenue, total profit, and sale count.
    """
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    result = (
        db.query(
            func.coalesce(func.sum(Sale.total_amount), 0.0),
            func.coalesce(func.sum(Sale.profit), 0.0),
            func.count(Sale.id),
        )
        .filter(
            Sale.user_id == current_user.id,
            Sale.created_at >= today_start,
            Sale.created_at <= today_end,
        )
        .first()
    )

    return {
        "date": date.today().isoformat(),
        "total_sales": round(float(result[0] or 0), 2),
        "total_profit": round(float(result[1] or 0), 2),
        "sale_count": int(result[2] or 0),
    }


@router.get("/weekly")
async def weekly_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get the last 7 days sales summary with daily breakdown.
    """
    today = date.today()
    start_date = today - timedelta(days=6)
    start = datetime.combine(start_date, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    rows = (
        db.query(
            func.date(Sale.created_at).label("day"),
            func.coalesce(func.sum(Sale.total_amount), 0.0).label("total_sales"),
            func.coalesce(func.sum(Sale.profit), 0.0).label("total_profit"),
            func.count(Sale.id).label("sale_count"),
        )
        .filter(
            Sale.user_id == current_user.id,
            Sale.created_at >= start,
            Sale.created_at <= end,
        )
        .group_by(func.date(Sale.created_at))
        .all()
    )

    by_day = {
        str(r.day)[:10]: {
            "total_sales": round(float(r.total_sales or 0), 2),
            "total_profit": round(float(r.total_profit or 0), 2),
            "sale_count": int(r.sale_count or 0),
        }
        for r in rows
    }

    daily_data = []
    total_sales = 0.0
    total_profit = 0.0
    total_count = 0
    for i in range(7):
        day = (start_date + timedelta(days=i)).isoformat()
        entry = by_day.get(day, {"total_sales": 0.0, "total_profit": 0.0, "sale_count": 0})
        daily_data.append(DailySummary(date=day, **entry))
        total_sales += entry["total_sales"]
        total_profit += entry["total_profit"]
        total_count += entry["sale_count"]

    return WeeklySummary(
        start_date=start_date.isoformat(),
        end_date=today.isoformat(),
        total_sales=round(total_sales, 2),
        total_profit=round(total_profit, 2),
        sale_count=total_count,
        daily_breakdown=daily_data,
    )


@router.get("/top-products")
async def top_products(
    days: int = Query(30, description="Look back period in days"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get the top-selling products by quantity over the given period.
    """
    since = datetime.now() - timedelta(days=days)

    results = (
        db.query(
            SaleItem.product_id,
            func.coalesce(SaleItem.product_name, Product.name, "Deleted product").label("product_name"),
            func.sum(SaleItem.quantity).label("total_quantity"),
            func.sum(SaleItem.total_price).label("total_revenue"),
        )
        .outerjoin(Product, SaleItem.product_id == Product.id)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            Sale.user_id == current_user.id,
            Sale.created_at >= since,
        )
        .group_by(SaleItem.product_id, SaleItem.product_name, Product.name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        TopProduct(
            product_id=r.product_id,
            product_name=r.product_name,
            total_quantity=int(r.total_quantity or 0),
            total_revenue=round(float(r.total_revenue or 0), 2),
        )
        for r in results
    ]


@router.get("", response_model=List[SaleRead])
async def list_sales(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    List sales with optional date range filtering.
    """
    query = (
        db.query(Sale)
        .filter(Sale.user_id == current_user.id)
    )

    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Sale.created_at >= sd)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")

    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Sale.created_at < ed)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")

    sales = query.order_by(Sale.created_at.desc()).offset(skip).limit(limit).all()
    return [SaleRead.model_validate(s) for s in sales]


@router.get("/{sale_id}", response_model=SaleRead)
async def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Get a single sale by ID with all its items."""
    sale = (
        db.query(Sale)
        .filter(Sale.id == sale_id, Sale.user_id == current_user.id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return SaleRead.model_validate(sale)


@router.post("", response_model=SaleRead, status_code=status.HTTP_201_CREATED)
async def create_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Create a new sale and auto-deduct inventory.

    Each item in the sale reduces the product quantity. If insufficient
    stock, the request is rejected.
    """
    if not sale_data.items:
        raise HTTPException(status_code=400, detail="Sale must have at least one item")

    total_amount = 0.0
    total_profit = 0.0
    sale_items = []

    for item in sale_data.items:
        product = (
            db.query(Product)
            .filter(Product.id == item.product_id, Product.user_id == current_user.id)
            .first()
        )
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with id {item.product_id} not found",
            )
        if product.quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.quantity}, requested: {item.quantity}",
            )

        line_total = item.unit_price * item.quantity
        line_profit = (item.unit_price - product.buying_price) * item.quantity

        total_amount += line_total
        total_profit += line_profit

        # Deduct inventory
        product.quantity -= item.quantity

        sale_items.append(SaleItem(
            product_id=product.id,
            product_name=product.name,
            cost_price=product.buying_price,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=line_total,
        ))

    sale = Sale(
        user_id=current_user.id,
        customer_id=sale_data.customer_id,
        total_amount=round(total_amount, 2),
        profit=round(total_profit, 2),
        payment_method=sale_data.payment_method,
    )
    db.add(sale)
    db.flush()  # Get sale.id

    for si in sale_items:
        si.sale_id = sale.id
        db.add(si)

    if sale_data.payment_method == "credit":
        if sale_data.customer_id is None:
            raise HTTPException(status_code=400, detail="A customer is required for a credit sale")
        customer = (
            db.query(Customer)
            .filter(Customer.id == sale_data.customer_id, Customer.user_id == current_user.id)
            .first()
        )
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        db.add(CreditEntry(
            customer_id=customer.id,
            amount=round(total_amount, 2),
            paid=0.0,
            remaining=round(total_amount, 2),
            notes=f"Credit sale #{sale.id}",
            entry_type=EntryType.CREDIT,
        ))

    db.commit()
    db.refresh(sale)
    return SaleRead.model_validate(sale)
