"""Authentication and Operator Onboarding API Endpoints."""
from fastapi import APIRouter, Depends, status

from app.api.deps import get_uow, get_current_user, get_current_active_business
from app.core.rate_limiter import rate_limit_login
from app.services.auth_service import AuthService
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from models.user import User
from schemas.user import (
    RegisterRequest,
    UserLogin,
    TokenResponse,
    AuthMeResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Business and Owner",
    description="Atomically creates a new Business tenant and its initial Owner account, returning a signed JWT.",
)
def register_business_and_owner(
    payload: RegisterRequest,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> TokenResponse:
    """Atomic registration of new business entity and owner identity via AuthService."""
    service = AuthService(uow)
    return service.register_business_and_owner(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate Operator",
    description="Authenticate with email and password to receive a signed JWT access token.",
    dependencies=[Depends(rate_limit_login)],
)
def login(
    payload: UserLogin,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> TokenResponse:
    """Authenticate existing user credentials and issue signed JWT via AuthService."""
    service = AuthService(uow)
    return service.login_user(payload)


@router.get(
    "/me",
    response_model=AuthMeResponse,
    summary="Current User Profile",
    description="Retrieve verified identity and tenant profile for the authenticated session.",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> AuthMeResponse:
    """Introspect active user profile and tenant affiliation via AuthService."""
    service = AuthService(uow)
    return service.get_current_user_profile(current_user=current_user, current_business=current_business)
