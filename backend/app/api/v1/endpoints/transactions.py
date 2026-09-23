"""Transaction API endpoints — tenant-isolated."""
from typing import List
from fastapi import APIRouter, Depends, status

from app.api.deps import get_uow, get_current_active_business, require_role
from app.services.transaction_service import TransactionService
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from models.user import User
from schemas.transaction import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    limit: int = 100,
    offset: int = 0,
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[TransactionResponse]:
    """Retrieve all transactions belonging to the authenticated tenant via TransactionService."""
    service = TransactionService(uow)
    return service.get_transactions(business_id=current_business.id, limit=limit, offset=offset)


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction_in: TransactionCreate,
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(require_role(["OWNER", "ADMIN"])),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> TransactionResponse:
    """
    Record a new business transaction with line items via TransactionService.
    Requires OWNER or ADMIN role — MEMBER will receive 403 Forbidden.
    The authenticated tenant's business ID is always authoritative.
    Every referenced product must belong to the authenticated tenant.
    """
    service = TransactionService(uow)
    return service.create_transaction(business_id=current_business.id, transaction_in=transaction_in)


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction_by_id(
    transaction_id: int,
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> TransactionResponse:
    """
    Retrieve a specific transaction by ID via TransactionService — only if it belongs to the authenticated tenant.
    Returns 404 for cross-tenant transaction IDs.
    """
    service = TransactionService(uow)
    return service.get_transaction_by_id(business_id=current_business.id, transaction_id=transaction_id)
