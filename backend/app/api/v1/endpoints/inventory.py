"""Inventory API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from repositories.inventory_repository import InventoryRepository
from schemas.inventory import InventoryUpdate, InventoryResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=List[InventoryResponse])
def get_inventory(
    business_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> List[InventoryResponse]:
    """Retrieve inventory stock levels across products."""
    repo = InventoryRepository(db)
    return repo.get_all(business_id=business_id, limit=limit, offset=offset)


@router.get("/{product_id}", response_model=InventoryResponse)
def get_inventory_for_product(
    product_id: int,
    db: Session = Depends(get_db)
) -> InventoryResponse:
    """Retrieve stock level for a specific product."""
    repo = InventoryRepository(db)
    inventory = repo.get_by_product_id(product_id)
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory for product ID {product_id} not found"
        )
    return inventory


@router.patch("/{product_id}", response_model=InventoryResponse)
def update_inventory_for_product(
    product_id: int,
    inventory_in: InventoryUpdate,
    db: Session = Depends(get_db)
) -> InventoryResponse:
    """Update stock quantity or reorder threshold for a product."""
    repo = InventoryRepository(db)
    updated = repo.update(product_id, inventory_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory for product ID {product_id} not found"
        )
    return updated
