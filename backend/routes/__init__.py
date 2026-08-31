"""
Routes package for Kirana Smart Assistant.
Exports all API routers.
"""

from fastapi import APIRouter

from routes.auth import router as auth_router
from routes.products import router as products_router
from routes.sales import router as sales_router
from routes.customers import router as customers_router
from routes.dashboard import router as dashboard_router
from routes.reports import router as reports_router
from routes.notifications import router as notifications_router
from routes.barcode import router as barcode_router
from routes.assistant import router as assistant_router
from routes.settings import router as settings_router
from routes.categories import router as categories_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
api_router.include_router(products_router, prefix="/api/products", tags=["Products"])
api_router.include_router(sales_router, prefix="/api/sales", tags=["Sales"])
api_router.include_router(customers_router, prefix="/api/customers", tags=["Customers"])
api_router.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
api_router.include_router(reports_router, prefix="/api/reports", tags=["Reports"])
api_router.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
api_router.include_router(barcode_router, prefix="/api/barcode", tags=["Barcode"])
api_router.include_router(assistant_router, prefix="/api/assistant", tags=["Assistant"])
api_router.include_router(settings_router, prefix="/api/settings", tags=["Settings"])
api_router.include_router(categories_router, prefix="/api/categories", tags=["Categories"])

__all__ = ["api_router"]
