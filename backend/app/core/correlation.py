"""Request correlation and structured request lifecycle observability for NEXUS."""
import contextvars
import logging
import re
import time
import uuid
from typing import Optional
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

# Allowed characters: alphanumeric, hyphens, and underscores between 1 and 128 characters.
# Rejects control characters, newlines, CRLF injection, spaces, HTML/script tags, and oversized strings.
VALID_REQUEST_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]{1,128}$")

# Context-local storage for request correlation (async/concurrency safe)
_request_id_ctx_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)
_user_id_ctx_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "user_id", default=None
)
_business_id_ctx_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "business_id", default=None
)


def is_valid_request_id(request_id: Optional[str]) -> bool:
    """Validate that incoming request ID is non-empty, safe, and adheres to strict formatting rules."""
    if not request_id or not isinstance(request_id, str):
        return False
    return bool(VALID_REQUEST_ID_REGEX.match(request_id))


def get_request_id() -> str:
    """Retrieve the current request's correlation ID, or an empty string if outside request context."""
    return _request_id_ctx_var.get()


def get_request_user_id() -> Optional[int]:
    """Retrieve the authenticated user ID for the current request, or None."""
    return _user_id_ctx_var.get()


def get_request_business_id() -> Optional[int]:
    """Retrieve the authenticated business/tenant ID for the current request, or None."""
    return _business_id_ctx_var.get()


def set_request_context_user(
    user_id: Optional[int],
    business_id: Optional[int],
    request: Optional[object] = None,
) -> None:
    """Safely associate authenticated user and business IDs with the current request context."""
    if user_id is not None and not isinstance(user_id, int):
        user_id = None
    if business_id is not None and not isinstance(business_id, int):
        business_id = None
    _user_id_ctx_var.set(user_id)
    _business_id_ctx_var.set(business_id)
    if request is not None and hasattr(request, "state"):
        try:
            request.state.user_id = user_id
            request.state.business_id = business_id
        except Exception:
            pass


class RequestCorrelationMiddleware:
    """
    ASGI middleware ensuring that:
    1. Every HTTP request has a validated or server-generated correlation ID (X-Request-ID).
    2. The correlation ID is stored in a context variable for async/concurrency-safe observability.
    3. The correlation ID is guaranteed to be returned in the X-Request-ID response header across all
       response types (2xx, 401, 403, 404, 413, 429, 500).
    4. Structured request lifecycle metrics (method, path, status, duration_ms, request_id, user_id,
       business_id) are logged upon request completion.
    5. Sensitive data (passwords, tokens, credentials, authorization headers, request/response bodies)
       are never logged.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # 1. Extract and validate incoming X-Request-ID header
        incoming_id: Optional[str] = None
        for key, val in scope.get("headers", []):
            if key.lower() == b"x-request-id":
                try:
                    incoming_id = val.decode("utf-8", errors="replace").strip()
                except Exception:
                    incoming_id = None
                break

        if incoming_id and is_valid_request_id(incoming_id):
            request_id = incoming_id
        else:
            request_id = str(uuid.uuid4())

        # 2. Bind context variables (isolated per async task)
        req_token = _request_id_ctx_var.set(request_id)
        user_token = _user_id_ctx_var.set(None)
        biz_token = _business_id_ctx_var.set(None)

        # Ensure request.state has request_id
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["request_id"] = request_id

        method = scope.get("method", "UNKNOWN").upper()
        path = scope.get("path", "")
        start_time = time.perf_counter()
        response_status: int = 500

        headers_sent = False

        # 3. Intercept response start to inject X-Request-ID header authoritatively
        async def correlation_send(message: dict) -> None:
            nonlocal response_status, headers_sent
            if message["type"] == "http.response.start":
                response_status = message.get("status", 200)
                headers = MutableHeaders(scope=message)
                # Setting via MutableHeaders ensures exactly one instance without duplicate headers
                headers["X-Request-ID"] = request_id
                headers_sent = True
            await send(message)

        try:
            await self.app(scope, receive, correlation_send)
        except Exception as exc:
            if not headers_sent:
                logger.exception(
                    "[%s] Unhandled exception in middleware pipeline: %s %s: %s",
                    request_id,
                    method,
                    path,
                    exc,
                )
                from fastapi.responses import JSONResponse
                err_resp = JSONResponse(
                    status_code=500,
                    content={"detail": "An internal server error occurred."},
                )
                await err_resp(scope, receive, correlation_send)
                return
            raise
        finally:
            if logger.disabled:
                logger.disabled = False
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            uid = _user_id_ctx_var.get()
            bid = _business_id_ctx_var.get()
            if uid is None and "state" in scope:
                uid = scope["state"].get("user_id")
            if bid is None and "state" in scope:
                bid = scope["state"].get("business_id")

            # 4. Structured lifecycle logging (strictly avoiding sensitive parameters/bodies)
            extra_payload = {
                "request_id": request_id,
                "method": method,
                "path": path,
                "status_code": response_status,
                "duration_ms": duration_ms,
                "user_id": uid,
                "business_id": bid,
            }

            logger.info(
                "request_completed: method=%s path=%s status=%d duration_ms=%.2f request_id=%s user_id=%s business_id=%s",
                method,
                path,
                response_status,
                duration_ms,
                request_id,
                str(uid) if uid is not None else "-",
                str(bid) if bid is not None else "-",
                extra=extra_payload,
            )

            # 5. Reset context variables to prevent bleed across pooled async tasks
            _request_id_ctx_var.reset(req_token)
            _user_id_ctx_var.reset(user_token)
            _business_id_ctx_var.reset(biz_token)
