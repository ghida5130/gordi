"""Single-worker rate limiter (policy: concurrency=1)."""

from __future__ import annotations

import time
from threading import Lock


class RateLimiter:
    """Serialize requests and enforce minimum interval between paced calls.

    Unpaced calls still advance the clock so the next paced call respects the
    interval measured from the most recent request of either kind.
    """

    def __init__(self, min_interval_sec: float) -> None:
        if min_interval_sec < 0:
            raise ValueError("min_interval_sec must be >= 0")
        self._min_interval = min_interval_sec
        self._lock = Lock()
        self._last_at: float | None = None

    def wait(self) -> None:
        """Block until the min interval has elapsed, then mark now."""
        with self._lock:
            now = time.monotonic()
            if self._last_at is not None:
                elapsed = now - self._last_at
                remaining = self._min_interval - elapsed
                if remaining > 0:
                    time.sleep(remaining)
            self._last_at = time.monotonic()

    def touch(self) -> None:
        """Mark a request without waiting (intra-product secondary calls)."""
        with self._lock:
            self._last_at = time.monotonic()
