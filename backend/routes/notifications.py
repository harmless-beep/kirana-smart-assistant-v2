"""
Notification routes for Kirana Smart Assistant.
Manage notifications and trigger alerts for low stock, expiry, and overdue credits.
"""

from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.models import (
    Notification,
    NotificationType,
    Product,
    Customer,
    CreditEntry,
    User,
    EntryType,
)
from schemas.schemas import NotificationRead
from routes.auth import get_current_user_dep

router = APIRouter()


@router.get("", response_model=List[NotificationRead])
async def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    List all notifications for the current user.
    Use unread_only=true to filter only unread notifications.
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
    return [NotificationRead.model_validate(n) for n in notifications]


@router.put("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Mark a single notification as read."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return NotificationRead.model_validate(notif)


@router.post("/check")
async def check_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Trigger notification checks for:
    - Low stock items
    - Expiring products (within 30 days)
    - Overdue customer credits

    Returns a summary of new notifications created.
    """
    created = []

    # --- Low stock alerts ---
    low_stock_products = (
        db.query(Product)
        .filter(
            Product.user_id == current_user.id,
            Product.quantity <= Product.low_stock_limit,
        )
        .all()
    )
    for product in low_stock_products:
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == current_user.id,
                Notification.type == NotificationType.LOW_STOCK,
                Notification.title == f"Low stock: {product.name}",
                Notification.is_read == False,
            )
            .first()
        )
        if not existing:
            notif = Notification(
                user_id=current_user.id,
                title=f"Low stock: {product.name}",
                message=f"'{product.name}' has only {product.quantity} units left (limit: {product.low_stock_limit}). Consider reordering.",
                type=NotificationType.LOW_STOCK,
            )
            db.add(notif)
            created.append(f"Low stock: {product.name}")

    # --- Expiring products ---
    today = date.today()
    cutoff = today + timedelta(days=30)
    expiring = (
        db.query(Product)
        .filter(
            Product.user_id == current_user.id,
            Product.expiry_date.isnot(None),
            Product.expiry_date <= cutoff,
            Product.expiry_date >= today,
        )
        .all()
    )
    for product in expiring:
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == current_user.id,
                Notification.type == NotificationType.EXPIRING,
                Notification.title == f"Expiring: {product.name}",
                Notification.is_read == False,
            )
            .first()
        )
        if not existing:
            days_left = (product.expiry_date - today).days
            notif = Notification(
                user_id=current_user.id,
                title=f"Expiring: {product.name}",
                message=f"'{product.name}' expires in {days_left} days ({product.expiry_date}). Consider discounting or removing.",
                type=NotificationType.EXPIRING,
            )
            db.add(notif)
            created.append(f"Expiring: {product.name}")

    # --- Overdue credits ---
    customers = db.query(Customer).filter(Customer.user_id == current_user.id).all()
    for customer in customers:
        pending = (
            db.query(func.coalesce(func.sum(CreditEntry.remaining), 0.0))
            .filter(
                CreditEntry.customer_id == customer.id,
                CreditEntry.remaining > 0,
                CreditEntry.entry_type == EntryType.CREDIT,
            )
            .scalar()
        )
        if pending > 0:
            existing = (
                db.query(Notification)
                .filter(
                    Notification.user_id == current_user.id,
                    Notification.type == NotificationType.CREDIT_DUE,
                    Notification.title == f"Credit due: {customer.name}",
                    Notification.is_read == False,
                )
                .first()
            )
            if not existing:
                notif = Notification(
                    user_id=current_user.id,
                    title=f"Credit due: {customer.name}",
                    message=f"'{customer.name}' has Rs. {pending:,.2f} pending. Follow up for payment.",
                    type=NotificationType.CREDIT_DUE,
                )
                db.add(notif)
                created.append(f"Credit due: {customer.name}")

    db.commit()

    return {
        "message": f"Check complete. {len(created)} new notification(s) created.",
        "new_notifications": created,
    }
