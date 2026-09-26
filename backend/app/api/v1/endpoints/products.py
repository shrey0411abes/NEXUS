"""Product API endpoints — tenant-isolated."""
from typing import List
from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_uow, get_current_active_business, require_role
from app.services.product_service import ProductService
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from models.user import User
from schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=List[ProductResponse])
def get_products(
    limit: int = 100,
    offset: int = 0,
    include_archived: bool = Query(False, description="Include archived products in the result set"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[ProductResponse]:
    """Retrieve products belonging to the authenticated tenant via ProductService."""
    service = ProductService(uow)
    return service.get_products(
        business_id=current_business.id,
        limit=limit,
        offset=offset,
        include_archived=include_archived,
    )


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


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(require_role(["OWNER", "ADMIN"])),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> ProductResponse:
    """
    Update an existing product's editable attributes (name, category, SKU, unit_price).
    Requires OWNER or ADMIN role — MEMBER will receive 403 Forbidden.
    Returns 404 for cross-tenant product IDs.
    """
    service = ProductService(uow)
    return service.update_product(
        business_id=current_business.id,
        product_id=product_id,
        product_in=product_in,
    )


@router.post("/{product_id}/archive", response_model=ProductResponse)
def archive_product(
    product_id: int,
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(require_role(["OWNER", "ADMIN"])),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> ProductResponse:
    """
    Soft-archive a product SKU for the authenticated tenant.
    Requires OWNER or ADMIN role — MEMBER will receive 403 Forbidden.
    Returns 404 for cross-tenant product IDs.
    """
    service = ProductService(uow)
    return service.archive_product(
        business_id=current_business.id,
        product_id=product_id,
    )
