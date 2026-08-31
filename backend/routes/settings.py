"""
Settings routes for Kirana Smart Assistant.
Manage shop preferences and configuration.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.models import Setting, User
from schemas.schemas import SettingRead, SettingUpdate
from routes.auth import get_current_user_dep

router = APIRouter()


@router.get("", response_model=List[SettingRead])
async def list_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get all settings for the current user.
    """
    settings = db.query(Setting).filter(Setting.user_id == current_user.id).all()
    return [SettingRead.model_validate(s) for s in settings]


@router.get("/{key}")
async def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Get a single setting by key.
    """
    setting = (
        db.query(Setting)
        .filter(Setting.user_id == current_user.id, Setting.key == key)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")
    return SettingRead.model_validate(setting)


@router.put("", response_model=List[SettingRead])
async def update_settings(
    settings_data: List[SettingUpdate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Create or update multiple settings at once.

    Pass an array of key-value pairs. Existing keys are updated; new ones are created.
    """
    result = []
    for item in settings_data:
        existing = (
            db.query(Setting)
            .filter(Setting.user_id == current_user.id, Setting.key == item.key)
            .first()
        )
        if existing:
            existing.value = item.value
            result.append(existing)
        else:
            new_setting = Setting(
                user_id=current_user.id,
                key=item.key,
                value=item.value,
            )
            db.add(new_setting)
            db.flush()
            result.append(new_setting)

    db.commit()

    # Refresh all
    all_settings = db.query(Setting).filter(Setting.user_id == current_user.id).all()
    return [SettingRead.model_validate(s) for s in all_settings]


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Delete a setting by key."""
    setting = (
        db.query(Setting)
        .filter(Setting.user_id == current_user.id, Setting.key == key)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")

    db.delete(setting)
    db.commit()
    return None
