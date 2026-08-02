from __future__ import annotations

import json
from typing import Any

from garment_collector.adapters.base import SourceAdapter
from garment_collector.adapters.musinsa.parser import (
    build_actual_size_api_url,
    build_detail_api_url,
    build_options_api_url,
    build_product_url,
    parse_goods_detail_payload,
    parse_musinsa_html,
)
from garment_collector.http_client import SlowHttpClient
from garment_collector.models import ParsedProduct


class MusinsaAdapter(SourceAdapter):
    """Musinsa adapter using public goods-detail API (storefront JSON)."""

    name = "MUSINSA"

    def product_url(self, product_id: str) -> str:
        return build_product_url(product_id)

    def detail_api_url(self, product_id: str) -> str:
        return build_detail_api_url(product_id)

    def options_api_url(self, product_id: str) -> str:
        return build_options_api_url(product_id)

    def actual_size_api_url(self, product_id: str) -> str:
        return build_actual_size_api_url(product_id)

    def parse_product_html(
        self, product_id: str, product_url: str, html: bytes
    ) -> ParsedProduct:
        return parse_musinsa_html(product_id, product_url, html)

    def fetch_product(
        self, product_id: str, client: SlowHttpClient
    ) -> tuple[ParsedProduct, dict[str, Any], bytes]:
        """Fetch detail + actual-size (+ options) and parse.

        Returns (parsed, raw_bundle, primary_body_bytes).
        """
        detail_url = self.detail_api_url(product_id)
        detail_resp = client.get(detail_url)
        detail_payload = json.loads(detail_resp.content.decode("utf-8"))

        actual_size_payload: dict[str, Any] | None = None
        actual_size_url = self.actual_size_api_url(product_id)
        try:
            actual_resp = client.get(actual_size_url)
            actual_size_payload = json.loads(actual_resp.content.decode("utf-8"))
        except Exception:
            actual_size_payload = None

        options_payload: dict[str, Any] | None = None
        try:
            options_resp = client.get(self.options_api_url(product_id))
            options_payload = json.loads(options_resp.content.decode("utf-8"))
        except Exception:
            options_payload = None

        parsed = parse_goods_detail_payload(
            product_id,
            self.product_url(product_id),
            detail_payload,
            options_payload=options_payload,
            actual_size_payload=actual_size_payload,
        )
        raw_bundle = {
            "detail_url": detail_url,
            "detail_status": detail_resp.status_code,
            "detail": detail_payload,
            "actual_size_url": actual_size_url,
            "actual_size": actual_size_payload,
            "options": options_payload,
        }
        return parsed, raw_bundle, detail_resp.content
