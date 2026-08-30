"""Business API endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from repositories.business_repository import BusinessRepository
from schemas.business import BusinessCreate, BusinessResponse

router = APIRouter(prefix="/businesses", tags=["Businesses"])


@router.get("", response_model=List[BusinessResponse])
def get_businesses(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> List[BusinessResponse]:
    """Retrieve list of registered businesses."""
    repo = BusinessRepository(db)
    return repo.get_all(limit=limit, offset=offset)


@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(
    business_in: BusinessCreate,
    db: Session = Depends(get_db)
) -> BusinessResponse:
    """Register a new business."""
    repo = BusinessRepository(db)
    return repo.create(business_in)


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business_by_id(
    business_id: int,
    db: Session = Depends(get_db)
) -> BusinessResponse:
    """Retrieve details of a single business."""
    repo = BusinessRepository(db)
    business = repo.get_by_id(business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found"
        )
    return business
