"""
SQLAlchemy ORM models for Kirana Smart Assistant.
All models for the grocery store management system.
"""

from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    Text,
    LargeBinary,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
import enum

from database import Base


class UserRole(str, enum.Enum):
    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"


class EntryType(str, enum.Enum):
    CREDIT = "credit"
    PAYMENT = "payment"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CREDIT = "credit"
    ESEWA = "esewa"
    KHALTI = "khalti"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    OTHER = "other"


class NotificationType(str, enum.Enum):
    LOW_STOCK = "low_stock"
    EXPIRING = "expiring"
    CREDIT_DUE = "credit_due"
    GENERAL = "general"
    SALE = "sale"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    shop_name = Column(String(200), nullable=True)
    role = Column(SAEnum(UserRole), default=UserRole.OWNER, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    products = relationship("Product", back_populates="owner", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="owner", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="owner", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="owner", cascade="all, delete-orphan")
    settings = relationship("Setting", back_populates="owner", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="owner", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    icon = Column(String(50), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    owner = relationship("User", back_populates="categories")
    products = relationship("Product", back_populates="category_rel", primaryjoin="Category.name == Product.category", foreign_keys="Product.category", viewonly=True)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    brand = Column(String(100), nullable=True, index=True)
    buying_price = Column(Float, nullable=False, default=0.0)
    selling_price = Column(Float, nullable=False, default=0.0)
    quantity = Column(Integer, nullable=False, default=0)
    shelf_number = Column(String(20), nullable=True)
    barcode = Column(String(50), unique=True, nullable=True, index=True)
    expiry_date = Column(Date, nullable=True)
    # Uploaded images use short server paths. TEXT also safely supports the
    # local data-URL fallback when a shop temporarily has no API connection.
    image_path = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    low_stock_limit = Column(Integer, nullable=False, default=10)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

    owner = relationship("User", back_populates="products")
    category_rel = relationship("Category", back_populates="products", primaryjoin="Product.category == Category.name", foreign_keys="Product.category", viewonly=True)
    sale_items = relationship("SaleItem", back_populates="product")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20), nullable=True, index=True)
    address = Column(String(300), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    owner = relationship("User", back_populates="customers")
    credit_entries = relationship("CreditEntry", back_populates="customer", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="customer")


class CreditEntry(Base):
    __tablename__ = "credit_entries"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    paid = Column(Float, nullable=False, default=0.0)
    remaining = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    entry_type = Column(SAEnum(EntryType), nullable=False, default=EntryType.CREDIT)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    customer = relationship("Customer", back_populates="credit_entries")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    # Keep sale ownership independent from products so history survives deletion.
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    total_amount = Column(Float, nullable=False, default=0.0)
    profit = Column(Float, nullable=False, default=0.0)
    payment_method = Column(SAEnum(PaymentMethod), nullable=False, default=PaymentMethod.CASH)
    created_at = Column(DateTime, default=datetime.now, nullable=False, index=True)

    customer = relationship("Customer", back_populates="sales")
    owner = relationship("User", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    # Preserve a readable item name on receipts after product cleanup.
    product_name = Column(String(200), nullable=True)
    # Keep the original cost so historical profit does not change with edits.
    cost_price = Column(Float, nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(SAEnum(NotificationType), nullable=False, default=NotificationType.GENERAL)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False, index=True)

    owner = relationship("User", back_populates="notifications")


class ProductImage(Base):
    """Product photo bytes kept in the database so images survive server
    redeploys (free tiers like Render use ephemeral disk for uploads/)."""
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    data = Column(LargeBinary, nullable=False)
    content_type = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=True)

    owner = relationship("User", back_populates="settings")
