"""
Pydantic v2 schemas for Kirana Smart Assistant.
All request/response models with Create, Read, Update variants.
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    name: str
    phone: str
    password: str
    shop_name: Optional[str] = None
    role: Optional[str] = "owner"


class UserLogin(BaseModel):
    phone: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    shop_name: Optional[str] = None
    role: str
    created_at: datetime


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    shop_name: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


# ---------------------------------------------------------------------------
# Category schemas
# ---------------------------------------------------------------------------

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    icon: Optional[str] = None
    user_id: int


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None


# ---------------------------------------------------------------------------
# Product schemas
# ---------------------------------------------------------------------------

class ProductCreate(BaseModel):
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    buying_price: float = 0.0
    selling_price: float = 0.0
    quantity: int = 0
    shelf_number: Optional[str] = None
    barcode: Optional[str] = None
    expiry_date: Optional[date] = None
    image_path: Optional[str] = None
    description: Optional[str] = None
    low_stock_limit: int = 10


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    buying_price: float
    selling_price: float
    quantity: int
    shelf_number: Optional[str] = None
    barcode: Optional[str] = None
    expiry_date: Optional[date] = None
    image_path: Optional[str] = None
    description: Optional[str] = None
    low_stock_limit: int
    user_id: int
    created_at: datetime
    updated_at: datetime


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    buying_price: Optional[float] = None
    selling_price: Optional[float] = None
    quantity: Optional[int] = None
    shelf_number: Optional[str] = None
    barcode: Optional[str] = None
    expiry_date: Optional[date] = None
    image_path: Optional[str] = None
    description: Optional[str] = None
    low_stock_limit: Optional[int] = None


# ---------------------------------------------------------------------------
# Customer schemas
# ---------------------------------------------------------------------------

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    user_id: int
    created_at: datetime
    balance: float = 0.0


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


# ---------------------------------------------------------------------------
# CreditEntry schemas
# ---------------------------------------------------------------------------

class CreditEntryCreate(BaseModel):
    amount: float
    paid: float = 0.0
    notes: Optional[str] = None
    entry_type: str = "credit"


class CreditEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    amount: float
    paid: float
    remaining: float
    notes: Optional[str] = None
    entry_type: str
    created_at: datetime


class PaymentCreate(BaseModel):
    amount: float
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Sale / SaleItem schemas
# ---------------------------------------------------------------------------

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float


class SaleItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sale_id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    cost_price: Optional[float] = None
    quantity: int
    unit_price: float
    total_price: float


class SaleCreate(BaseModel):
    customer_id: Optional[int] = None
    items: List[SaleItemCreate]
    payment_method: str = "cash"


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: Optional[int] = None
    total_amount: float
    profit: float
    payment_method: str
    created_at: datetime
    items: List[SaleItemRead] = []


# ---------------------------------------------------------------------------
# Notification schemas
# ---------------------------------------------------------------------------

class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Setting schemas
# ---------------------------------------------------------------------------

class SettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    key: str
    value: Optional[str] = None


class SettingUpdate(BaseModel):
    key: str
    value: Optional[str] = None


# ---------------------------------------------------------------------------
# Dashboard / Report schemas
# ---------------------------------------------------------------------------

class DailySummary(BaseModel):
    date: str
    total_sales: float
    total_profit: float
    sale_count: int


class WeeklySummary(BaseModel):
    start_date: str
    end_date: str
    total_sales: float
    total_profit: float
    sale_count: int
    daily_breakdown: List[DailySummary] = []


class DashboardResponse(BaseModel):
    today_sales: float
    today_profit: float
    today_sale_count: int
    low_stock_count: int
    pending_credits: float
    total_products: int
    total_customers: int


class TopProduct(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    total_quantity: int
    total_revenue: float


# ---------------------------------------------------------------------------
# Assistant schemas
# ---------------------------------------------------------------------------

class AssistantQuery(BaseModel):
    query: str


class AssistantResponse(BaseModel):
    answer: str
    data: Optional[dict] = None


# ---------------------------------------------------------------------------
# Report export schemas
# ---------------------------------------------------------------------------

class ReportItem(BaseModel):
    date: str
    product_name: str
    quantity: int
    unit_price: float
    total: float
    profit: float
