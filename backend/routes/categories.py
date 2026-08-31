"""Editable product sections for each shop."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.models import Category, Product, User
from routes.auth import get_current_user_dep
from schemas.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter()


def _clean_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Section name is required")
    if len(cleaned) > 100:
        raise HTTPException(status_code=400, detail="Section name must be 100 characters or fewer")
    return cleaned


def _duplicate(db: Session, user_id: int, name: str, exclude_id: int | None = None) -> bool:
    query = db.query(Category).filter(Category.user_id == user_id, func.lower(Category.name) == name.lower())
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    return query.first() is not None


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    return db.query(Category).filter(Category.user_id == current_user.id).order_by(Category.name).all()


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    name = _clean_name(data.name)
    if _duplicate(db, current_user.id, name):
        raise HTTPException(status_code=400, detail="A section with this name already exists")
    category = Category(name=name, icon=data.icon, user_id=current_user.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    category = db.query(Category).filter(Category.id == category_id, Category.user_id == current_user.id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Section not found")

    if data.name is not None:
        name = _clean_name(data.name)
        if _duplicate(db, current_user.id, name, category_id):
            raise HTTPException(status_code=400, detail="A section with this name already exists")
        previous_name = category.name
        category.name = name
        db.query(Product).filter(Product.user_id == current_user.id, Product.category == previous_name).update({Product.category: name})
    if data.icon is not None:
        category.icon = data.icon
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    category = db.query(Category).filter(Category.id == category_id, Category.user_id == current_user.id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Section not found")
    db.query(Product).filter(Product.user_id == current_user.id, Product.category == category.name).update({Product.category: "Uncategorized"})
    db.delete(category)
    db.commit()
    return None
