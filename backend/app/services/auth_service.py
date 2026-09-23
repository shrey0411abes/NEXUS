"""Authentication and Operator Onboarding Application Service."""
from fastapi import HTTPException, status
from unit_of_work import AbstractUnitOfWork
from models.business import Business
from models.user import User
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    PasswordValidationError,
)
from schemas.business import BusinessCreate
from schemas.user import (
    RegisterRequest,
    UserLogin,
    TokenResponse,
    UserResponse,
    AuthMeResponse,
)


class AuthService:
    """Orchestrates authentication, onboarding, and identity workflows."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def register_business_and_owner(self, payload: RegisterRequest) -> TokenResponse:
        """
        Atomically register a new Business tenant and its initial Owner account within a single UoW transaction.
        """
        normalized_email = payload.email.strip().lower()

        # Check for existing email conflict
        if self.uow.users.get_by_email(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An account with email '{normalized_email}' already exists.",
            )

        # Validate password strength prior to hashing
        try:
            pw_hash = hash_password(payload.password)
        except PasswordValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            )

        # Atomic tenant onboarding transaction
        try:
            with self.uow:
                business = self.uow.businesses.create(
                    BusinessCreate(
                        name=payload.business_name.strip(),
                        industry=payload.business_industry.strip(),
                    )
                )
                user = self.uow.users.create(
                    business_id=business.id,
                    email=normalized_email,
                    password_hash=pw_hash,
                    role="OWNER",
                )
                self.uow.commit()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            )

        access_token = create_access_token(
            subject=str(user.id),
            business_id=business.id,
            role=user.role,
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
            business_name=business.name,
        )

    def login_user(self, payload: UserLogin) -> TokenResponse:
        """Authenticate user credentials and issue a signed JWT access token."""
        normalized_email = payload.email.strip().lower()
        user = self.uow.users.get_by_email(normalized_email)

        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        business = self.uow.businesses.get_by_id(user.business_id)
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated business tenant not found",
            )

        access_token = create_access_token(
            subject=str(user.id),
            business_id=business.id,
            role=user.role,
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
            business_name=business.name,
        )

    def get_current_user_profile(self, current_user: User, current_business: Business) -> AuthMeResponse:
        """Introspect authenticated user identity and tenant affiliation."""
        return AuthMeResponse(
            user=UserResponse.model_validate(current_user),
            business_id=current_business.id,
            business_name=current_business.name,
            business_industry=current_business.industry,
        )
