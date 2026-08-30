"""Transaction API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from repositories.business_repository import BusinessRepository
from repositories.product_repository import ProductRepository
from repositories.transaction_repository import TransactionRepository
from schemas.transaction import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    business_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> List[TransactionResponse]:
    """Retrieve list of completed transactions."""
    repo = TransactionRepository(db)
    return repo.get_all(business_id=business_id, limit=limit, offset=offset)


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction_in: TransactionCreate,
    db: Session = Depends(get_db)
) -> TransactionResponse:
    """Record a new business transaction with line items."""
    business_repo = BusinessRepository(db)
    if not business_repo.get_by_id(transaction_in.business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {transaction_in.business_id} does not exist"
        )

    # Validate that referenced products exist
    product_repo = ProductRepository(db)
    for item in transaction_in.items:
        product = product_repo.get_by_id(item.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item.product_id} does not exist"
            )

    tx_repo = TransactionRepository(db)
    try:
        return tx_repo.create(transaction_in)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction_by_id(
    transaction_id: int,
    db: Session = Depends(get_db)
) -> TransactionResponse:
    """Retrieve details of a specific transaction including its line items."""
    repo = TransactionRepository(db)
    transaction = repo.get_by_id(transaction_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {transaction_id} not found"
        )
    return transaction
