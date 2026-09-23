"""Inventory Application Service — tenant-isolated inventory management."""
from typing import List
from fastapi import HTTPException, status

from unit_of_work import AbstractUnitOfWork
from models.inventory import Inventory
from schemas.inventory import InventoryUpdate


class InventoryService:
    """Orchestrates tenant-scoped inventory adjustments and monitoring."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_inventory_list(self, business_id: int, limit: int = 100, offset: int = 0) -> List[Inventory]:
        """Retrieve inventory for all products belonging to the authenticated tenant."""
        safe_limit = min(max(1, limit), 1000)
        safe_offset = max(0, offset)
        return self.uow.inventory.get_all(business_id=business_id, limit=safe_limit, offset=safe_offset)

    def get_inventory_for_product(self, business_id: int, product_id: int) -> Inventory:
        """
        Retrieve inventory for a specific product, verifying tenant ownership.
        Returns 404 for cross-tenant product IDs.
        """
        inventory = self.uow.inventory.get_for_business(product_id=product_id, business_id=business_id)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory for product ID {product_id} not found",
            )
        return inventory

    def update_inventory(
        self,
        business_id: int,
        product_id: int,
        inventory_in: InventoryUpdate,
    ) -> Inventory:
        """
        Update stock quantity or reorder threshold for a tenant's product.
        Verifies product ownership prior to mutation.
        """
        product = self.uow.products.get_for_business(product_id=product_id, business_id=business_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory for product ID {product_id} not found",
            )

        with self.uow:
            inventory = self.uow.inventory.update(product_id, inventory_in)
            if not inventory:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inventory for product ID {product_id} not found",
                )
            self.uow.commit()
            return inventory
