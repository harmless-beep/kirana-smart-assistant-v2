"""
Customer / Khata routes for Kirana Smart Assistant.
Manage customers, credit entries, and payment tracking.
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from database import get_db
from models.models import Customer, CreditEntry, User, EntryType
from schemas.schemas import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    CreditEntryCreate,
    CreditEntryRead,
    PaymentCreate,
)
from routes.auth import get_current_user_dep

router = APIRouter()


def _balances_for_customers(db: Session, customer_ids) -> dict[int, float]:
    """Return the outstanding khata balance for many customers in one query."""
    if not customer_ids:
        return {}
    rows = (
        db.query(CreditEntry.customer_id, func.coalesce(func.sum(CreditEntry.remaining), 0.0))
        .filter(
            CreditEntry.customer_id.in_(customer_ids),
            CreditEntry.remaining > 0,
            CreditEntry.entry_type == EntryType.CREDIT,
        )
        .group_by(CreditEntry.customer_id)
        .all()
    )
    return {cid: round(float(balance or 0), 2) for cid, balance in rows}


def _customer_read(customer: Customer, balances: dict[int, float]) -> CustomerRead:
    """Return a customer with the current outstanding khata balance."""
    return CustomerRead.model_validate(customer).model_copy(
        update={"balance": balances.get(customer.id, 0.0)}
    )


@router.get("/overdue", response_model=list[CustomerRead])
async def overdue_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get customers who have pending credit balances (overdue).
    """
    customers = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .all()
    )
    balances = _balances_for_customers(db, [c.id for c in customers])
    overdue = [c for c in customers if balances.get(c.id, 0) > 0]
    return [_customer_read(c, balances) for c in overdue]


@router.get("", response_model=list[CustomerRead])
async def list_customers(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """List all customers with optional search."""
    query = db.query(Customer).filter(Customer.user_id == current_user.id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(pattern),
                Customer.phone.ilike(pattern),
            )
        )

    customers = query.order_by(Customer.name).offset(skip).limit(limit).all()
    balances = _balances_for_customers(db, [c.id for c in customers])
    return [_customer_read(c, balances) for c in customers]


@router.get("/{customer_id}", response_model=CustomerRead)
async def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Get a single customer by ID."""
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return _customer_read(customer, _balances_for_customers(db, [customer.id]))


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Create a new customer (for khata/credit tracking)."""
    customer = Customer(
        name=data.name,
        phone=data.phone,
        address=data.address,
        user_id=current_user.id,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _customer_read(customer, {})


@router.put("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Update customer details."""
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return _customer_read(customer, _balances_for_customers(db, [customer.id]))


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Delete a customer and its Khata entries, while retaining past sales."""
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    db.delete(customer)
    db.commit()


@router.get("/{customer_id}/credits", response_model=list[CreditEntryRead])
async def list_credits(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get the credit/payment history for a customer.
    """
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    entries = (
        db.query(CreditEntry)
        .filter(CreditEntry.customer_id == customer_id)
        .order_by(CreditEntry.created_at.desc())
        .all()
    )
    return [CreditEntryRead.model_validate(e) for e in entries]


@router.post("/{customer_id}/credits", response_model=CreditEntryRead, status_code=status.HTTP_201_CREATED)
async def add_credit(
    customer_id: int,
    data: CreditEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Add a credit entry (khata) for a customer.

    This records that the customer owes the given amount.
    """
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    remaining = data.amount - data.paid
    entry = CreditEntry(
        customer_id=customer_id,
        amount=data.amount,
        paid=data.paid,
        remaining=max(remaining, 0.0),
        notes=data.notes,
        entry_type=EntryType.CREDIT,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return CreditEntryRead.model_validate(entry)


@router.post("/{customer_id}/payments", response_model=CreditEntryRead, status_code=status.HTTP_201_CREATED)
async def add_payment(
    customer_id: int,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Record a payment from a customer.

    This creates a payment entry and reduces the oldest pending credit.
    """
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Find pending credit entries (oldest first)
    pending_entries = (
        db.query(CreditEntry)
        .filter(
            CreditEntry.customer_id == customer_id,
            CreditEntry.remaining > 0,
            CreditEntry.entry_type == EntryType.CREDIT,
        )
        .order_by(CreditEntry.created_at.asc())
        .all()
    )

    if not pending_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending credit entries for this customer",
        )

    payment_remaining = data.amount

    for entry in pending_entries:
        if payment_remaining <= 0:
            break

        reduction = min(entry.remaining, payment_remaining)
        entry.paid += reduction
        entry.remaining -= reduction
        payment_remaining -= reduction

    # Record the payment entry
    payment = CreditEntry(
        customer_id=customer_id,
        amount=data.amount,
        paid=data.amount,
        remaining=0.0,
        notes=data.notes or f"Payment of {data.amount}",
        entry_type=EntryType.PAYMENT,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return CreditEntryRead.model_validate(payment)
