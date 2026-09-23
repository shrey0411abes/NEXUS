"""Repository for Product persistence operations."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.product import Product
from models.inventory import Inventory
from schemas.product import ProductCreate


class ProductRepository:
    """Encapsulates database operations for Product entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_all(self, business_id: Optional[int] = None, limit: int = 100, offset: int = 0) -> List[Product]:
        """Retrieve products, optionally filtered by business ID."""
        stmt = select(Product).order_by(Product.id.asc())
        if business_id is not None:
            stmt = stmt.where(Product.business_id == business_id)
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
