"""Repository for Product persistence operations."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.product import Product
from models.inventory import Inventory
from schemas.product import ProductCreate, ProductUpdate


class ProductRepository:
    """Encapsulates database operations for Product entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_all(
        self,
        business_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
        include_archived: bool = False,
    ) -> List[Product]:
        """Retrieve products, optionally filtered by business ID and active status."""
        stmt = select(Product).order_by(Product.id.asc())
        if business_id is not None:
            stmt = stmt.where(Product.business_id == business_id)
        if not include_archived:
            stmt = stmt.where(Product.is_active.is_(True))
        stmt = stmt.offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, product_id: int) -> Optional[Product]:
        """Retrieve a product by its primary key."""
        return self.db.get(Product, product_id)

    def get_for_business(self, product_id: int, business_id: int) -> Optional[Product]:
        """Retrieve a product by ID strictly scoped to a specific business tenant."""
        stmt = select(Product).where(
            Product.id == product_id,
            Product.business_id == business_id
        )
        return self.db.scalars(stmt).first()

    def get_by_sku(self, business_id: int, sku: str) -> Optional[Product]:
        """Retrieve a product by business ID and SKU."""
        stmt = select(Product).where(
            Product.business_id == business_id,
            Product.sku == sku.strip()
        )
        return self.db.scalars(stmt).first()

    def count(self, business_id: Optional[int] = None) -> int:
        """Count total products, optionally filtered by business ID."""
        from sqlalchemy import func
        stmt = select(func.count(Product.id))
        if business_id is not None:
            stmt = stmt.where(Product.business_id == business_id)
        return self.db.scalar(stmt) or 0

    def create(self, product_in: ProductCreate) -> Product:
        """Create and stage a new product along with its 1-to-1 inventory record."""
        price = Decimal(str(product_in.unit_price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        product = Product(
            business_id=product_in.business_id,
            name=product_in.name,
            category=product_in.category,
            sku=product_in.sku,
            unit_price=price,
        )
        try:
            self.db.add(product)
            self.db.flush()  # Populate product.id for inventory linkage

            # Create corresponding 1-to-1 Inventory entry
            inventory = Inventory(
                product_id=product.id,
                quantity=product_in.initial_quantity,
                reorder_level=product_in.reorder_level,
            )
            self.db.add(inventory)
            self.db.flush()
            self.db.refresh(product)
            return product
        except Exception:
            self.db.rollback()
            raise

    def update(
        self,
        product_id: int,
        product_in: ProductUpdate,
        business_id: Optional[int] = None,
    ) -> Optional[Product]:
        """Update and stage product attributes on the session."""
        product = self.get_for_business(product_id, business_id) if business_id else self.get_by_id(product_id)
        if not product:
            return None

        if product_in.name is not None:
            product.name = product_in.name.strip()
        if product_in.category is not None:
            product.category = product_in.category.strip()
        if product_in.sku is not None:
            product.sku = product_in.sku.strip()
        if product_in.unit_price is not None:
            product.unit_price = Decimal(str(product_in.unit_price)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        try:
            self.db.flush()
            self.db.refresh(product)
            return product
        except Exception:
            self.db.rollback()
            raise

    def archive(self, product_id: int, business_id: Optional[int] = None) -> Optional[Product]:
        """Mark product as inactive (soft archival). Idempotent."""
        product = self.get_for_business(product_id, business_id) if business_id else self.get_by_id(product_id)
        if not product:
            return None

        product.is_active = False
        try:
            self.db.flush()
            self.db.refresh(product)
            return product
        except Exception:
            self.db.rollback()
            raise
