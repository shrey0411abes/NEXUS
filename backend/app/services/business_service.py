"""Business Application Service — tenant-isolated business operations."""
from fastapi import HTTPException, status
from unit_of_work import AbstractUnitOfWork
from models.business import Business


class BusinessService:
    """Orchestrates tenant-scoped business entity operations."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_business_by_id(self, business_id: int, current_business: Business) -> Business:
        """
        Retrieve a business entity by ID.
        Returns 404 unless the requested ID matches the authenticated tenant.
        """
        if business_id != current_business.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID {business_id} not found",
            )
        return current_business
