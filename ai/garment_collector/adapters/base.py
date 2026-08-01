from __future__ import annotations

from abc import ABC, abstractmethod

from garment_collector.models import ParsedProduct


class SourceAdapter(ABC):
    name: str

    @abstractmethod
    def parse_product_html(
        self, product_id: str, product_url: str, html: bytes
    ) -> ParsedProduct:
        raise NotImplementedError

    @abstractmethod
    def product_url(self, product_id: str) -> str:
        raise NotImplementedError
