"""VLM-based structured attribute extraction for query images.

The extractor turns a user query photo into the same ``GarmentTags``
vocabulary the text keyword extractor produces, so image evidence can
participate in the rule-based compatibility scoring instead of only
influencing the embedding similarity.

Values outside the closed vocabulary are dropped rather than trusted:
the VLM output is grounding input for scoring, not free-form content.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

from app.recommendation.pipeline import (
    _COLOR_KEYWORDS,
    _PATTERN_KEYWORDS,
    _SEASON_KEYWORDS,
    _STYLE_KEYWORDS,
    GarmentTags,
)
from app.recommendation.vlm import (
    OpenAICompatibleVLMClient,
    VLMError,
    image_part,
    text_part,
)

_ALLOWED_COLORS = frozenset(_COLOR_KEYWORDS)
_ALLOWED_SEASONS = frozenset(_SEASON_KEYWORDS)
_ALLOWED_STYLES = frozenset(_STYLE_KEYWORDS)
_ALLOWED_PATTERNS = frozenset(_PATTERN_KEYWORDS)

_SYSTEM_PROMPT = (
    "You are a fashion attribute tagger. Look at the garment(s) in the "
    "user's photo and answer with one JSON object only, no prose. "
    "Schema: {\"colors\": [], \"seasons\": [], \"styles\": [], "
    "\"patterns\": []}. Use only these values and omit anything you "
    "are not confident about:\n"
    f"colors: {sorted(_ALLOWED_COLORS)}\n"
    f"seasons: {sorted(_ALLOWED_SEASONS)}\n"
    f"styles: {sorted(_ALLOWED_STYLES)}\n"
    f"patterns: {sorted(_ALLOWED_PATTERNS)}\n"
    "colors are the dominant garment colors (max 3). seasons reflect "
    "when the outfit would realistically be worn. styles describe the "
    "overall mood. patterns describe the fabric print."
)

_USER_INSTRUCTION = (
    "Tag the clothing attributes in this photo as JSON."
)


class VLMClient(Protocol):
    def complete_json(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Return one parsed JSON object from the model."""


class VLMImageAttributeExtractor:
    def __init__(self, client: VLMClient) -> None:
        self._client = client

    def extract(
        self,
        *,
        image: bytes,
        mime_type: str,
    ) -> GarmentTags:
        payload = self._client.complete_json(
            system=_SYSTEM_PROMPT,
            user_parts=[
                image_part(image, mime_type),
                text_part(_USER_INSTRUCTION),
            ],
        )
        return tags_from_payload(payload)


def tags_from_payload(payload: dict[str, Any]) -> GarmentTags:
    return GarmentTags(
        colors=_filter_values(payload.get("colors"), _ALLOWED_COLORS),
        seasons=_filter_values(
            payload.get("seasons"),
            _ALLOWED_SEASONS,
        ),
        styles=_filter_values(payload.get("styles"), _ALLOWED_STYLES),
        patterns=_filter_values(
            payload.get("patterns"),
            _ALLOWED_PATTERNS,
        ),
    )


def _filter_values(
    values: Any,
    allowed: frozenset[str],
) -> frozenset[str]:
    if not isinstance(values, list):
        return frozenset()
    normalized = {
        str(value).strip().upper()
        for value in values
        if isinstance(value, str)
    }
    return frozenset(normalized & allowed)


def build_extractor(
    client: OpenAICompatibleVLMClient,
) -> VLMImageAttributeExtractor:
    return VLMImageAttributeExtractor(client)


__all__ = [
    "VLMClient",
    "VLMError",
    "VLMImageAttributeExtractor",
    "build_extractor",
    "tags_from_payload",
]


if __name__ == "__main__":  # pragma: no cover - manual smoke helper
    import sys
    from pathlib import Path

    from app.recommendation.vlm import VLMSettings

    image_path = Path(sys.argv[1])
    settings = VLMSettings(api_key=sys.argv[2])
    with OpenAICompatibleVLMClient(settings) as vlm_client:
        extractor = VLMImageAttributeExtractor(vlm_client)
        tags = extractor.extract(
            image=image_path.read_bytes(),
            mime_type=(
                "image/png"
                if image_path.suffix.lower() == ".png"
                else "image/jpeg"
            ),
        )
    print(
        json.dumps(
            {
                "colors": sorted(tags.colors),
                "seasons": sorted(tags.seasons),
                "styles": sorted(tags.styles),
                "patterns": sorted(tags.patterns),
            },
            ensure_ascii=False,
        )
    )
