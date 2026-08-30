"""Repository for Transaction and TransactionItem persistence operations."""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.transaction import Transaction, TransactionItem
from schemas.transaction import TransactionCreate


class TransactionRepository:
    """Encapsulates database operations for Transaction entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_all(self, business_id: Optional[int] = None, limit: int = 100, offset: int = 0) -> List[Transaction]:
        """Retrieve transactions, optionally filtered by business ID."""
        stmt = select(Transaction).order_by(Transaction.id.desc())
        if business_id is not None:
            stmt = stmt.where(Transaction.business_id == business_id)
        stmt = stmt.offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, transaction_id: int) -> Optional[Transaction]:
        """Retrieve a transaction by primary key."""
        return self.db.get(Transaction, transaction_id)

    def create(self, transaction_in: TransactionCreate) -> Transaction:
        """Create a new transaction with associated line items, ensuring cross-business integrity."""
        from models.product import Product

        # Calculate total amount if omitted
        total_amount = transaction_in.total_amount
        if total_amount is None:
            total_amount = sum(
                item.quantity * item.unit_price for item in transaction_in.items
            )

        transaction = Transaction(
            business_id=transaction_in.business_id,
            transaction_type=transaction_in.transaction_type,
            total_amount=total_amount,
        )
        try:
            self.db.add(transaction)
            self.db.flush()

            for item_in in transaction_in.items:
                product = self.db.get(Product, item_in.product_id)
                if not product:
                    raise ValueError(f"Product with ID {item_in.product_id} does not exist")
                if product.business_id != transaction_in.business_id:
                    raise ValueError(
                        f"Cross-business product mismatch: Product {product.id} belongs to "
                        f"business {product.business_id}, not business {transaction_in.business_id}"
                    )

                item = TransactionItem(
                    transaction_id=transaction.id,
                    product_id=item_in.product_id,
                    quantity=item_in.quantity,
                    unit_price=item_in.unit_price,
                )
                self.db.add(item)

            self.db.commit()
            self.db.refresh(transaction)
            return transaction
        except Exception:
            self.db.rollback()
            raise
