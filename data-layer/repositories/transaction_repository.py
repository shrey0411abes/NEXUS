"""Repository for Transaction and TransactionItem persistence operations."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.transaction import Transaction, TransactionItem
from schemas.transaction import TransactionCreate, calculate_transaction_total


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

    def get_for_business(self, transaction_id: int, business_id: int) -> Optional[Transaction]:
        """Retrieve a transaction by ID strictly scoped to a specific business tenant."""
        stmt = select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.business_id == business_id
        )
        return self.db.scalars(stmt).first()

    def count(self, business_id: Optional[int] = None) -> int:
        """Count transactions, optionally filtered by business ID."""
        from sqlalchemy import func
        stmt = select(func.count(Transaction.id))
        if business_id is not None:
            stmt = stmt.where(Transaction.business_id == business_id)
        return self.db.scalar(stmt) or 0

    def create(self, transaction_in: TransactionCreate) -> Transaction:
        """Stage creation of a new transaction with associated line items on the session."""
        from models.product import Product

        # Authoritative total calculation using canonical calculation logic
        calculated_total = calculate_transaction_total(transaction_in.items)
        if transaction_in.total_amount is not None:
            supplied_total = Decimal(str(transaction_in.total_amount)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if supplied_total != calculated_total:
                raise ValueError(
                    f"Transaction total mismatch: supplied {supplied_total} "
                    f"does not match calculated total {calculated_total}"
                )
            total_amount = calculated_total
        else:
            total_amount = calculated_total

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

                item_price = Decimal(str(item_in.unit_price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                item = TransactionItem(
                    transaction_id=transaction.id,
                    product_id=item_in.product_id,
                    quantity=item_in.quantity,
                    unit_price=item_price,
                )
                self.db.add(item)

            self.db.flush()
            self.db.refresh(transaction)
            return transaction
        except Exception:
            self.db.rollback()
            raise
