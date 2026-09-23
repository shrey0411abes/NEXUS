"""Product API endpoints — tenant-isolated."""
from typing import List
from fastapi import APIRouter, Depends, status

from app.api.deps import get_uow, get_current_active_business, require_role
from app.services.product_service import ProductService
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from models.user import User
from schemas.product import ProductCreate, ProductResponse

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=List[ProductResponse])
def get_products(
    limit: int = 100,
    offset: int = 0,
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[ProductResponse]:
    """Retrieve all products belonging to the authenticated tenant via ProductService."""
    service = ProductService(uow)
    return service.get_products(business_id=current_business.id, limit=limit, offset=offset)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(require_role(["OWNER", "ADMIN"])),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> ProductResponse:
    """
    Create a new product SKU for the authenticated tenant via ProductService.
    Requires OWNER or ADMIN role — MEMBER will receive 403 Forbidden.
    The authenticated tenant's business ID is always authoritative.
    """
    service = ProductService(uow)
    return service.create_product(business_id=current_business.id, product_in=product_in)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product_by_id(
    product_id: int,
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> ProductResponse:
    """
    Retrieve a product by ID via ProductService — only if it belongs to the authenticated tenant.
    Returns 404 for cross-tenant product IDs to prevent resource enumeration.
    """
    service = ProductService(uow)
    return service.get_product_by_id(business_id=current_business.id, product_id=product_id)
