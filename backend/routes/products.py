"""
Product management routes for Kirana Smart Assistant.
Full CRUD with search, low-stock alerts, and expiry tracking.
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models.models import Product, ProductImage, User
from schemas.schemas import ProductCreate, ProductRead, ProductUpdate
from routes.auth import get_current_user_dep

router = APIRouter()

MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


@router.post("/upload-image")
async def upload_product_image(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Store a camera/gallery image in the database and return a path the
    product form can save. Images live in the DB (not ephemeral disk), so
    they survive server redeploys."""
    extension = IMAGE_EXTENSIONS.get(image.content_type or "")
    if not extension:
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG, or WebP image")

    contents = await image.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The selected image is empty")
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")

    record = ProductImage(data=contents, content_type=image.content_type)
    db.add(record)
    db.commit()
    db.refresh(record)
    # This router is mounted at /api/products, so the serve route below
    # lives at /api/products/images/{id}.
    return {"image_path": f"/api/products/images/{record.id}"}


@router.get("/images/{image_id}")
async def get_product_image(
    image_id: int,
    db: Session = Depends(get_db),
):
    """Serve a product photo stored in the database."""
    record = db.query(ProductImage).filter(ProductImage.id == image_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=record.data, media_type=record.content_type)


@router.get("", response_model=list[ProductRead])
async def list_products(
    search: Optional[str] = Query(None, description="Search by name or brand"),
    category: Optional[str] = Query(None, description="Filter by category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    List all products for the authenticated user.

    Supports optional search by name/brand and category filtering.
    """
    query = db.query(Product).filter(Product.user_id == current_user.id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_pattern),
                Product.brand.ilike(search_pattern),
                Product.category.ilike(search_pattern),
            )
        )

    if category:
        query = query.filter(Product.category == category)

    products = query.order_by(Product.name).offset(skip).limit(limit).all()
    return [ProductRead.model_validate(p) for p in products]


@router.get("/search", response_model=list[ProductRead])
async def search_products(
    q: str = Query(..., min_length=1, description="Search query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Fuzzy search products by name, brand, or category.
    
    Returns products matching the query string in any of these fields.
    """
    search_pattern = f"%{q}%"
    products = (
        db.query(Product)
        .filter(
            Product.user_id == current_user.id,
            or_(
                Product.name.ilike(search_pattern),
                Product.brand.ilike(search_pattern),
                Product.category.ilike(search_pattern),
                Product.barcode.ilike(search_pattern),
            ),
        )
        .order_by(Product.name)
        .all()
    )
    return [ProductRead.model_validate(p) for p in products]


@router.get("/low-stock", response_model=list[ProductRead])
async def low_stock_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get products where current quantity is below the low_stock_limit.
    Useful for reorder alerts.
    """
    products = (
        db.query(Product)
        .filter(
            Product.user_id == current_user.id,
            Product.quantity <= Product.low_stock_limit,
        )
        .order_by(Product.quantity)
        .all()
    )
    return [ProductRead.model_validate(p) for p in products]


@router.get("/expiring", response_model=list[ProductRead])
async def expiring_products(
    days: int = Query(30, description="Number of days to check ahead"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get products expiring within the specified number of days (default 30).
    """
    today = date.today()
    cutoff = today + timedelta(days=days)
    products = (
        db.query(Product)
        .filter(
            Product.user_id == current_user.id,
            Product.expiry_date.isnot(None),
            Product.expiry_date <= cutoff,
            Product.expiry_date >= today,
        )
        .order_by(Product.expiry_date)
        .all()
    )
    return [ProductRead.model_validate(p) for p in products]


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Get a single product by ID."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductRead.model_validate(product)


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Create a new product in the shop inventory."""
    # Check for duplicate barcode if provided
    if product_data.barcode:
        existing = (
            db.query(Product)
            .filter(Product.barcode == product_data.barcode, Product.user_id == current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A product with this barcode already exists",
            )

    product = Product(
        name=product_data.name,
        category=product_data.category,
        brand=product_data.brand,
        buying_price=product_data.buying_price,
        selling_price=product_data.selling_price,
        quantity=product_data.quantity,
        shelf_number=product_data.shelf_number,
        barcode=product_data.barcode,
        expiry_date=product_data.expiry_date,
        image_path=product_data.image_path,
        description=product_data.description,
        low_stock_limit=product_data.low_stock_limit,
        user_id=current_user.id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductRead.model_validate(product)


@router.put("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Update an existing product. Only provided fields are changed."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = product_data.model_dump(exclude_unset=True)

    # Check barcode uniqueness if being changed
    if "barcode" in update_data and update_data["barcode"]:
        existing = (
            db.query(Product)
            .filter(
                Product.barcode == update_data["barcode"],
                Product.user_id == current_user.id,
                Product.id != product_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A product with this barcode already exists",
            )

    for field, value in update_data.items():
        setattr(product, field, value)

    from datetime import datetime
    product.updated_at = datetime.now()

    db.commit()
    db.refresh(product)
    return ProductRead.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Delete a product from inventory."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    db.delete(product)
    db.commit()
    return None
