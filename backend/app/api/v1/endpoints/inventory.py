"""Inventory API endpoints — tenant-isolated."""
from typing import List
from fastapi import APIRouter, Depends

from app.api.deps import get_uow, get_current_active_business, require_role
from app.services.inventory_service import InventoryService
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from models.user import User
from schemas.inventory import InventoryUpdate, InventoryResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=List[InventoryResponse])
def get_inventory(
    limit: int = 100,
    offset: int = 0,
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[InventoryResponse]:
    """Retrieve inventory for all products belonging to the authenticated tenant via InventoryService."""
    service = InventoryService(uow)
    return service.get_inventory_list(business_id=current_business.id, limit=limit, offset=offset)


@router.get("/{product_id}", response_model=InventoryResponse)
def get_inventory_for_product(
    product_id: int,
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> InventoryResponse:
    """
    Retrieve inventory for a specific product via InventoryService — only if it belongs to the authenticated tenant.
    Returns 404 for cross-tenant product IDs.
    """
    service = InventoryService(uow)
    return service.get_inventory_for_product(business_id=current_business.id, product_id=product_id)


@router.patch("/{product_id}", response_model=InventoryResponse)
def update_inventory_for_product(
    product_id: int,
    inventory_in: InventoryUpdate,
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(require_role(["OWNER", "ADMIN"])),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> InventoryResponse:
    """
    Update stock quantity or reorder threshold for a product via InventoryService.
    Requires OWNER or ADMIN role — MEMBER will receive 403.
    Product must belong to the authenticated tenant.
    """
    service = InventoryService(uow)
    return service.update_inventory(
        business_id=current_business.id,
        product_id=product_id,
        inventory_in=inventory_in,
    )
