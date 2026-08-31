"""
Barcode routes for Kirana Smart Assistant.
Generate barcode images and look up products by barcode.
"""

from io import BytesIO
import os
import tempfile

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models.models import Product, User
from schemas.schemas import ProductRead
from routes.auth import get_current_user_dep

router = APIRouter()


@router.get("/{product_id}")
async def generate_barcode(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Generate a barcode image (Code128) for a product.

    If the product doesn't have a barcode, one is auto-generated from its ID.
    Returns a PNG image.
    """
    try:
        import barcode
        from barcode.writer import ImageWriter
    except ImportError:
        raise HTTPException(status_code=500, detail="python-barcode library not installed")

    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    barcode_value = product.barcode or f"KIR{product.id:06d}"

    buffer = BytesIO()
    code128 = barcode.get("code128", barcode_value, writer=ImageWriter())
    code128.write(buffer, options={
        "module_width": 0.3,
        "module_height": 15.0,
        "font_size": 10,
        "text_distance": 5.0,
        "quiet_zone": 6.5,
    })

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="barcode_{product.id}.png"',
        },
    )


@router.post("/scan", response_model=ProductRead)
async def scan_barcode(
    barcode_value: str = Body(..., embed=True, description="The scanned barcode value"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Look up a product by its barcode string.

    Accepts a barcode value in the request body ({"barcode_value": "..."})
    and returns the matching product.
    """
    product = (
        db.query(Product)
        .filter(
            Product.barcode == barcode_value,
            Product.user_id == current_user.id,
        )
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No product found with barcode: {barcode_value}",
        )
    return ProductRead.model_validate(product)
