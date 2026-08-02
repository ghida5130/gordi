"""Policy-enforced defaults from docs/garment-data-collection-policy-v1.md v1.1.0."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from garment_collector import (
    COLLECTOR_NAME,
    POLICY_EXCEPTION,
    SCHEMA_VERSION,
    __version__,
)

# Hard limits — do not expose easy CLI overrides that lift these.
MAX_ITEMS_PILOT = 200
PRODUCT_REQUEST_DELAY_SEC = 3.0
IMAGE_REQUEST_DELAY_SEC = 1.0
MAX_RETRIES = 2
MAX_CONCURRENCY = 1

COLLECTION_METHOD = "public-html-slow-fetch"
RIGHTS_STATUS = "internal-evaluation-only-unverified"
ROBOTS_TXT_NOTE = "2026-07-29: User-agent:* Disallow:/"

MIN_IMAGE_EDGE_PX = 500
RECOMMENDED_PRIMARY_WIDTH_PX = 1000

DEFAULT_USER_AGENT = (
    "GordiGarmentCollector/1.0 (+internal-mvp; contact=team-internal)"
)

STOP_HTTP_STATUSES = frozenset({403, 429, 503})


@dataclass(frozen=True)
class CollectorSettings:
    """Runtime settings with policy caps applied."""

    dataset_root: Path
    source: str = "MUSINSA"
    max_items: int = MAX_ITEMS_PILOT
    product_delay_sec: float = PRODUCT_REQUEST_DELAY_SEC
    image_delay_sec: float = IMAGE_REQUEST_DELAY_SEC
    max_retries: int = MAX_RETRIES
    user_agent: str = DEFAULT_USER_AGENT
    dry_run: bool = False

    def __post_init__(self) -> None:
        if self.max_items < 1:
            raise ValueError("max_items must be >= 1")
        if self.max_items > MAX_ITEMS_PILOT:
            raise ValueError(
                f"max_items cannot exceed pilot cap {MAX_ITEMS_PILOT} "
                "(revise policy document before expanding)"
            )
        if self.product_delay_sec < PRODUCT_REQUEST_DELAY_SEC:
            raise ValueError(
                f"product_delay_sec must be >= {PRODUCT_REQUEST_DELAY_SEC}"
            )
        if self.image_delay_sec < IMAGE_REQUEST_DELAY_SEC:
            raise ValueError(
                f"image_delay_sec must be >= {IMAGE_REQUEST_DELAY_SEC}"
            )
        if self.max_retries > MAX_RETRIES:
            raise ValueError(f"max_retries cannot exceed {MAX_RETRIES}")

    @property
    def collector_name(self) -> str:
        return COLLECTOR_NAME

    @property
    def collector_version(self) -> str:
        return __version__

    @property
    def schema_version(self) -> str:
        return SCHEMA_VERSION

    @property
    def collection_method(self) -> str:
        return COLLECTION_METHOD

    @property
    def rights_status(self) -> str:
        return RIGHTS_STATUS

    @property
    def policy_exception(self) -> str:
        return POLICY_EXCEPTION

    @property
    def robots_txt_note(self) -> str:
        return ROBOTS_TXT_NOTE
