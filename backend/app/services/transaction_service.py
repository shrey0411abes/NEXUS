"""Transaction Application Service — tenant-isolated transaction processing."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List
from fastapi import HTTPException, status

from unit_of_work import AbstractUnitOfWork
from models.transaction import Transaction
from schemas.transaction import TransactionCreate, calculate_transaction_total


class TransactionService:
    """Orchestrates tenant-scoped transaction recording and line item validation."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_transactions(self, business_id: int, limit: int = 100, offset: int = 0) -> List[Transaction]:
        """Retrieve all transactions belonging to the authenticated tenant."""
        safe_limit = min(max(1, limit), 1000)
        safe_offset = max(0, offset)
        return self.uow.transactions.get_all(business_id=business_id, limit=safe_limit, offset=safe_offset)

    def get_transaction_by_id(self, business_id: int, transaction_id: int) -> Transaction:
        """
        Retrieve a specific transaction by ID, verifying tenant ownership.
        Returns 404 for cross-tenant IDs.
        """
        transaction = self.uow.transactions.get_for_business(transaction_id=transaction_id, business_id=business_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction with ID {transaction_id} not found",
            )
        return transaction

    def create_transaction(self, business_id: int, transaction_in: TransactionCreate) -> Transaction:
        """
        Record a new business transaction with line items within an atomic UoW transaction.
        Enforces tenant binding, authoritative total validation, and product tenant isolation.
        """
        # Force authoritative tenant context
        transaction_in.business_id = business_id

        # Canonical authoritative total calculation and validation
        calculated_total = calculate_transaction_total(transaction_in.items)
        if transaction_in.total_amount is not None:
            supplied_total = Decimal(str(transaction_in.total_amount)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if supplied_total != calculated_total:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"Transaction total mismatch: supplied {supplied_total} "
                        f"does not match authoritative calculated total {calculated_total}"
                    ),
                )
            transaction_in.total_amount = calculated_total
        else:
            transaction_in.total_amount = calculated_total

        # Validate that every product belongs to the authenticated tenant
        for item in transaction_in.items:
            product = self.uow.products.get_by_id(item.product_id)
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {item.product_id} does not exist",
                )
            if product.business_id != business_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cross-business product mismatch: product {item.product_id} does not belong to this business",
                )

        try:
            with self.uow:
                transaction = self.uow.transactions.create(transaction_in)
                self.uow.commit()
                return transaction
        except ValueError as exc:
            msg = str(exc)
            if "total mismatch" in msg:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=msg)
            if "does not exist" in msg:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
