"""Product API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from repositories.business_repository import BusinessRepository
from repositories.product_repository import ProductRepository
from schemas.product import ProductCreate, ProductResponse

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=List[ProductResponse])
def get_products(
    business_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> List[ProductResponse]:
    """Retrieve list of products, optionally filtered by business ID."""
    repo = ProductRepository(db)
    return repo.get_all(business_id=business_id, limit=limit, offset=offset)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db)
) -> ProductResponse:
    """Create a new product SKU and initialize its 1-to-1 inventory."""
    business_repo = BusinessRepository(db)
    if not business_repo.get_by_id(product_in.business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {product_in.business_id} does not exist"
        )

    product_repo = ProductRepository(db)
    existing_sku = product_repo.get_by_sku(product_in.business_id, product_in.sku)
    if existing_sku:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{product_in.sku}' already exists for business {product_in.business_id}"
        )

    return product_repo.create(product_in)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product_by_id(
    product_id: int,
    db: Session = Depends(get_db)
) -> ProductResponse:
    """Retrieve details of a single product SKU."""
    repo = ProductRepository(db)
    product = repo.get_by_id(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found"
        )
    return product
