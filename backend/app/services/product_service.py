"""Product Application Service — tenant-isolated catalog management."""
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from unit_of_work import AbstractUnitOfWork
from models.product import Product
from schemas.product import ProductCreate


class ProductService:
    """Orchestrates tenant-scoped product catalog operations."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_products(self, business_id: int, limit: int = 100, offset: int = 0) -> List[Product]:
        """Retrieve all catalog products belonging to the authenticated tenant."""
        safe_limit = min(max(1, limit), 1000)
        safe_offset = max(0, offset)
        return self.uow.products.get_all(business_id=business_id, limit=safe_limit, offset=safe_offset)

    def get_product_by_id(self, business_id: int, product_id: int) -> Product:
        """
        Retrieve a specific product by ID, verifying tenant ownership.
        Returns 404 for cross-tenant IDs to prevent enumeration.
        """
        product = self.uow.products.get_for_business(product_id=product_id, business_id=business_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found",
            )
        return product

    def create_product(self, business_id: int, product_in: ProductCreate) -> Product:
        """
        Create a new product and initial inventory record bound to the authenticated tenant.
        Enforces tenant binding, input normalization, and SKU uniqueness (pre-check + DB constraint).
        """
        # Force authoritative tenant context
        product_in.business_id = business_id

        # Normalize domain fields
        normalized_sku = product_in.sku.strip()
        if not normalized_sku:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="SKU cannot be empty",
            )
        product_in.sku = normalized_sku
        product_in.name = product_in.name.strip()
        product_in.category = product_in.category.strip()

        # Application-level pre-validation for friendly error messaging
        existing_sku = self.uow.products.get_by_sku(business_id, product_in.sku)
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product with SKU '{product_in.sku}' already exists for this business",
            )

        # Atomic persistence with database constraint integrity fallback
        try:
            with self.uow:
                product = self.uow.products.create(product_in)
                self.uow.commit()
                return product
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product with SKU '{product_in.sku}' already exists for this business",
            )
