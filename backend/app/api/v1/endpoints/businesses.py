"""Business API endpoints — tenant-isolated."""
from fastapi import APIRouter, Depends

from app.api.deps import get_uow, get_current_active_business
from app.services.business_service import BusinessService
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from schemas.business import BusinessResponse

router = APIRouter(prefix="/businesses", tags=["Businesses"])


@router.get("/me", response_model=BusinessResponse)
def get_my_business(
    current_business: Business = Depends(get_current_active_business),
) -> BusinessResponse:
    """Retrieve the authenticated user's own business tenant."""
    return current_business


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business_by_id(
    business_id: int,
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> BusinessResponse:
    """
    Retrieve a business by ID via BusinessService.
    Returns 404 unless the ID matches the authenticated tenant's business —
    prevents cross-tenant enumeration.
    """
    service = BusinessService(uow)
    return service.get_business_by_id(business_id=business_id, current_business=current_business)
