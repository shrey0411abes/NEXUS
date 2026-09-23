"""Repository for Inventory persistence operations."""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.inventory import Inventory
from models.product import Product
from schemas.inventory import InventoryUpdate


class InventoryRepository:
    """Encapsulates database operations for Inventory entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_all(self, business_id: Optional[int] = None, limit: int = 100, offset: int = 0) -> List[Inventory]:
        """Retrieve inventory records, optionally filtered by business ID."""
        stmt = select(Inventory).order_by(Inventory.id.asc())
        if business_id is not None:
            stmt = stmt.join(Product, Inventory.product_id == Product.id).where(Product.business_id == business_id)
        stmt = stmt.offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_by_product_id(self, product_id: int) -> Optional[Inventory]:
        """Retrieve the inventory record for a specific product."""
        stmt = select(Inventory).where(Inventory.product_id == product_id)
        return self.db.scalars(stmt).first()

    def get_for_business(self, product_id: int, business_id: int) -> Optional[Inventory]:
        """Retrieve the inventory record for a product strictly scoped to a specific business tenant."""
        stmt = select(Inventory).join(Product, Inventory.product_id == Product.id).where(
            Inventory.product_id == product_id,
            Product.business_id == business_id
        )
        return self.db.scalars(stmt).first()

    def count(self, business_id: Optional[int] = None) -> int:
        """Count inventory records, optionally filtered by business ID."""
        from sqlalchemy import func
        stmt = select(func.count(Inventory.id))
        if business_id is not None:
            stmt = stmt.join(Product, Inventory.product_id == Product.id).where(Product.business_id == business_id)
        return self.db.scalar(stmt) or 0

    def update(self, product_id: int, inventory_in: InventoryUpdate) -> Optional[Inventory]:
        """Update and stage inventory stock quantity and/or reorder level on session."""
        inventory = self.get_by_product_id(product_id)
        if not inventory:
            return None

        if inventory_in.quantity is not None:
            inventory.quantity = inventory_in.quantity
        if inventory_in.reorder_level is not None:
            inventory.reorder_level = inventory_in.reorder_level

        try:
            self.db.flush()
            self.db.refresh(inventory)
            return inventory
        except Exception:
            self.db.rollback()
            raise
