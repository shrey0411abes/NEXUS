"""Middleware components for HTTP security headers and request body hardening."""
import logging
from typing import Optional
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send
from app.core.config import settings

logger = logging.getLogger(__name__)


class PayloadTooLargeError(HTTPException):
    """Raised when request payload exceeds the configured maximum upload size."""
    def __init__(self, detail: str = "Request payload exceeds the maximum allowed size."):
        super().__init__(status_code=413, detail=detail)


class SecurityHeadersMiddleware:
    """
    ASGI middleware that attaches standard HTTP security headers to all responses.

    Headers enforced:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - Referrer-Policy: strict-origin-when-cross-origin
    - Strict-Transport-Security: max-age=31536000; includeSubDomains (emitted conditionally
      only when operating behind HTTPS / production TLS assumptions)

    Content-Security-Policy (CSP) Note:
    NEXUS backend is an API service serving JSON endpoints and OpenAPI docs in debug mode.
    The user interface is a separate Single Page Application (frontend/ Vite/React SPA).
    CSP is designed for HTML document execution. Applying restrictive CSP at the API layer
    would break OpenAPI/Swagger UI in debug mode while providing no defense for application/json
    payloads (already safeguarded by nosniff). CSP belongs authoritatively on the frontend
    hosting/reverse-proxy layer serving the HTML documents.
    """

    def __init__(self, app: ASGIApp, is_production: Optional[bool] = None) -> None:
        self.app = app
        self.is_production = (
            is_production
            if is_production is not None
            else (settings.ENVIRONMENT.lower() == "production")
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

                # Conditional HSTS: emit only when operating behind HTTPS / production TLS
                is_https = scope.get("scheme") == "https"
                if not is_https:
                    for k, v in scope.get("headers", []):
                        if k.lower() == b"x-forwarded-proto" and v.lower() == b"https":
                            is_https = True
                            break

                if self.is_production or is_https:
                    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

            await send(message)

        await self.app(scope, receive, send_with_security_headers)


class RequestSizeLimitMiddleware:
    """
    ASGI middleware that enforces a global maximum request body size (default: 2 MB).

    Rejection strategy:
    1. Fast-path rejection: Evaluates Content-Length header upfront before reading the
       body or executing downstream application routing/business logic.
    2. Streaming/chunked protection: Wraps the ASGI receive callable to count cumulative
       incoming bytes and aborts immediately if the limit is exceeded without buffering
       oversized payloads into memory.
    3. Safe methods (GET, HEAD, OPTIONS) bypass body size validation.
    """

    def __init__(self, app: ASGIApp, max_upload_size: Optional[int] = None) -> None:
        self.app = app
        self.max_upload_size = (
            max_upload_size
            if max_upload_size is not None
            else settings.MAX_REQUEST_BODY_SIZE
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET").upper()
        # Safe methods without request body payload requirements
        if method in ("GET", "HEAD", "OPTIONS"):
            await self.app(scope, receive, send)
            return

        # 1. Fast-path check via Content-Length header
        content_length_header: Optional[bytes] = None
        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length":
                content_length_header = value
                break

        if content_length_header is not None:
            try:
                content_length = int(content_length_header)
                if content_length < 0:
                    response = JSONResponse(
                        status_code=400,
                        content={"detail": "Invalid Content-Length header."},
                    )
                    await response(scope, receive, send)
                    return

                if content_length > self.max_upload_size:
                    logger.warning(
                        "Oversized request rejected by Content-Length header: %d bytes (limit: %d bytes)",
                        content_length,
                        self.max_upload_size,
                    )
                    response = JSONResponse(
                        status_code=413,
                        content={
                            "detail": (
                                f"Request payload exceeds the maximum allowed size of "
                                f"{self.max_upload_size} bytes."
                            )
                        },
                    )
                    await response(scope, receive, send)
                    return
            except ValueError:
                response = JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header."},
                )
                await response(scope, receive, send)
                return

        # 2. Streaming / chunked payload protection via wrapped receive
        received_bytes = 0
        response_started = False

        async def limited_receive() -> dict:
            nonlocal received_bytes
            message = await receive()
            if message["type"] == "http.request":
                chunk = message.get("body", b"")
                received_bytes += len(chunk)
                if received_bytes > self.max_upload_size:
                    logger.warning(
                        "Oversized request rejected during streaming receive: > %d bytes",
                        self.max_upload_size,
                    )
                    raise PayloadTooLargeError(
                        f"Request payload exceeds the maximum allowed size of "
                        f"{self.max_upload_size} bytes."
                    )
            return message

        async def tracked_send(message: dict) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except PayloadTooLargeError as exc:
            if not response_started:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": exc.detail},
                )
                await response(scope, receive, send)
