"""Dependency injection helpers and security guards for FastAPI backend."""
from typing import Generator, List, Callable
import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from models.user import User
from repositories.business_repository import BusinessRepository
from repositories.user_repository import UserRepository
from app.core.config import settings
from app.core.correlation import set_request_context_user
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=True,
)


def get_uow(db: Session = Depends(get_db)) -> SqlAlchemyUnitOfWork:
    """
    Provide a Unit of Work instance managing repositories and transaction boundaries
    for the current request session.
    """
    return SqlAlchemyUnitOfWork(db)


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate the incoming JWT Bearer token, extract the subject identifier,
    and resolve the active User entity from the database source of truth.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    set_request_context_user(user.id, user.business_id, request=request)
    return user


def get_current_active_business(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Business:
    """
    Resolve the authorized Business tenant entity associated with the authenticated user.
    Never accepts client-provided tenant identifiers.
    """
    biz_repo = BusinessRepository(db)
    business = biz_repo.get_by_id(current_user.business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated business tenant not found",
        )
    return business


def require_role(allowed_roles: List[str]) -> Callable[[User], User]:
    """
    Dependency factory that enforces Role-Based Access Control (RBAC).
    Rejects unauthorized roles with HTTP 403 Forbidden.
    """
    def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the following roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return _role_checker


def get_investigation_service(
    request: Request,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
):
    """
    Provide an InvestigationService instance with request-scoped UoW and configured LLM provider.
    """
    from app.services.investigation_service import InvestigationService
    provider = getattr(request.app.state, "llm_provider", None)
    return InvestigationService(uow=uow, provider=provider)


__all__ = [
    "get_db",
    "get_uow",
    "Session",
    "oauth2_scheme",
    "get_current_user",
    "get_current_active_business",
    "require_role",
    "get_investigation_service",
]

