"""
Dashboard routes for Kirana Smart Assistant.
Quick summary stats for the shop owner's home screen.
"""

from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.models import Product, Customer, Sale, SaleItem, CreditEntry, User, EntryType
from schemas.schemas import DashboardResponse
from routes.auth import get_current_user_dep

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get the main dashboard summary:
    - Today's sales and profit
    - Low stock item count
    - Pending credit balance
    - Total products and customers
    """
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    # Today's sales. Sale rows carry user_id directly, so no joins are
    # needed — joining SaleItem/Product would multiply the SUM by the
    # number of items per sale and double the totals.
    today_sales_result = (
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

    # Low stock count
    low_stock_count = (
        db.query(func.count(Product.id))
        .filter(
            Product.user_id == current_user.id,
            Product.quantity <= Product.low_stock_limit,
        )
        .scalar()
    )

    # Pending credits
    pending_credits = (
        db.query(func.coalesce(func.sum(CreditEntry.remaining), 0.0))
        .join(Customer)
        .filter(
            Customer.user_id == current_user.id,
            CreditEntry.remaining > 0,
            CreditEntry.entry_type == EntryType.CREDIT,
        )
        .scalar()
    )

    total_products = (
        db.query(func.count(Product.id))
        .filter(Product.user_id == current_user.id)
        .scalar()
    )

    total_customers = (
        db.query(func.count(Customer.id))
        .filter(Customer.user_id == current_user.id)
        .scalar()
    )

    return DashboardResponse(
        today_sales=round(float(today_sales_result[0] or 0), 2),
        today_profit=round(float(today_sales_result[1] or 0), 2),
        today_sale_count=today_sales_result[2] or 0,
        low_stock_count=low_stock_count or 0,
        pending_credits=round(float(pending_credits or 0), 2),
        total_products=total_products or 0,
        total_customers=total_customers or 0,
    )


@router.get("/weekly")
async def weekly_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get weekly dashboard with daily breakdown for the last 7 days.
    """
    today = date.today()
    start = datetime.combine(today - timedelta(days=6), datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    # One grouped query instead of seven per-day queries.
    rows = (
        db.query(
            func.date(Sale.created_at).label("day"),
            func.coalesce(func.sum(Sale.total_amount), 0.0).label("total_sales"),
            func.coalesce(func.sum(Sale.profit), 0.0).label("total_profit"),
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
        }
        for r in rows
    }

    daily = []
    for i in range(7):
        day = (today - timedelta(days=6 - i)).isoformat()
        daily.append({"date": day, **by_day.get(day, {"total_sales": 0.0, "total_profit": 0.0})})

    return {"start_date": start.date().isoformat(), "end_date": today.isoformat(), "daily": daily}
