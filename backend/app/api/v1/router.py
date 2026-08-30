"""API v1 Router aggregation."""
from fastapi import APIRouter
from app.api.v1.endpoints import (
    businesses,
    products,
    inventory,
    transactions,
    analytics,
    recommendations,
    investigations,
    cross_domain,
    financial,
)

api_router = APIRouter()

api_router.include_router(businesses.router)
api_router.include_router(products.router)
api_router.include_router(inventory.router)
api_router.include_router(transactions.router)
api_router.include_router(analytics.router)
api_router.include_router(recommendations.router)
api_router.include_router(investigations.router)
api_router.include_router(cross_domain.router)
api_router.include_router(financial.router)


