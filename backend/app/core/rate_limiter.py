"""
In-process thread-safe rate limiter and route abuse prevention dependencies.
"""
import math
import threading
import time
from collections import deque
from typing import Callable, Dict, Optional, Tuple
from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings
from app.api.deps import get_current_active_business, get_current_user
from models.business import Business
from models.user import User


class RateLimiter:
    """
    Thread-safe, sliding-window rate limiter using monotonic time and bounded memory.

    - Uses monotonic clock (immune to NTP and daylight saving adjustments).
    - Sliding window log with deque for microsecond-accurate window accounting.
    - Thread-safe serialization via threading.Lock to eliminate race conditions.
    - Strict memory bounding: active eviction when capacity threshold is reached,
      plus passive cleanup of expired keys on request boundaries.
    """

    def __init__(
        self,
        time_func: Optional[Callable[[], float]] = None,
        max_tracked_keys: int = 20_000,
        cleanup_interval_seconds: float = 60.0,
    ) -> None:
        self._time_func: Callable[[], float] = time_func or time.monotonic
        self._max_tracked_keys = max_tracked_keys
        self._cleanup_interval_seconds = cleanup_interval_seconds
        self._lock = threading.Lock()
        self._storage: Dict[str, deque] = {}
        self._last_cleanup: float = self._time_func()

    def set_time_func(self, time_func: Optional[Callable[[], float]]) -> None:
        """Override the time source (primarily for deterministic unit testing)."""
        with self._lock:
            self._time_func = time_func or time.monotonic

    def check(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Evaluate whether the request with `key` is allowed within `window_seconds`.

        Returns:
            (True, 0) if allowed.
            (False, retry_after_seconds) if limit is exceeded.
        """
        now = self._time_func()
        window_start = now - window_seconds

        with self._lock:
            # Periodic sweep of expired entries
            if now - self._last_cleanup >= self._cleanup_interval_seconds:
                self._cleanup_expired_locked(now, window_seconds)
                self._last_cleanup = now

            timestamps = self._storage.get(key)
            if timestamps is None:
                # Capacity guard: evict oldest entry to bound memory growth
                if len(self._storage) >= self._max_tracked_keys:
                    oldest_key = next(iter(self._storage))
                    del self._storage[oldest_key]
                timestamps = deque()
                self._storage[key] = timestamps

            # Evict timestamps older than the sliding window
            while timestamps and timestamps[0] <= window_start:
                timestamps.popleft()

            if len(timestamps) >= max_requests:
                # Exceeded quota: compute exact seconds until the oldest timestamp exits window
                oldest = timestamps[0]
                retry_after = max(1, int(math.ceil(oldest + window_seconds - now)))
                return False, retry_after

            # Allowed: record request timestamp in window
            timestamps.append(now)
            return True, 0

    def _cleanup_expired_locked(self, now: float, default_window: int) -> None:
        """Evict tracked keys that have no timestamps within the active window."""
        cutoff = now - default_window
        keys_to_delete = []
        for k, q in self._storage.items():
            while q and q[0] <= cutoff:
                q.popleft()
            if not q:
                keys_to_delete.append(k)
        for k in keys_to_delete:
            del self._storage[k]

    def reset(self) -> None:
        """Reset all tracked state (used for test isolation)."""
        with self._lock:
            self._storage.clear()
            self._last_cleanup = self._time_func()


# Global application rate limiter instance
limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address from network connection peer.
    Does not blindly trust user-supplied X-Forwarded-For headers from untrusted clients.
    """
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def rate_limit_login(request: Request) -> None:
    """
    FastAPI dependency that enforces rate limiting on POST /api/v1/auth/login.
    Policy: 5 attempts per 60 seconds per client IP.
    """
    client_ip = get_client_ip(request)
    key = f"auth:login:{client_ip}"
    allowed, retry_after = limiter.check(
        key=key,
        max_requests=settings.RATE_LIMIT_LOGIN_MAX_REQUESTS,
        window_seconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def rate_limit_investigations(
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    FastAPI dependency that enforces rate limiting on POST /api/v1/investigations.
    Policy: 10 requests per 60 seconds per authenticated tenant + user.
    """
    key = f"investigations:tenant:{current_business.id}:user:{current_user.id}"
    allowed, retry_after = limiter.check(
        key=key,
        max_requests=settings.RATE_LIMIT_INVESTIGATION_MAX_REQUESTS,
        window_seconds=settings.RATE_LIMIT_INVESTIGATION_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
