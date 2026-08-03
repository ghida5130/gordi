"""Read the recommendation catalog from the backend-owned MySQL database."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from typing import Any, Protocol

import pymysql
from pymysql.connections import Connection
from pymysql.cursors import DictCursor


class CatalogError(RuntimeError):
    """Raised when the product catalog cannot be loaded safely."""


@dataclass(frozen=True)
class CatalogDatabaseSettings:
    host: str
    port: int
    database: str
    user: str
    password: str

    @classmethod
    def from_env(cls) -> "CatalogDatabaseSettings":
        required = (
            "MYSQL_HOST",
            "MYSQL_DATABASE",
            "MYSQL_USER",
            "MYSQL_PASSWORD",
        )
        missing = [name for name in required if not os.environ.get(name)]
        if missing:
            raise CatalogError(
                f"missing required environment variables: {missing}"
            )
        try:
            port = int(os.environ.get("MYSQL_PORT", "3306"))
        except ValueError as exc:
            raise CatalogError("MYSQL_PORT must be an integer") from exc
        return cls(
            host=os.environ["MYSQL_HOST"],
            port=port,
            database=os.environ["MYSQL_DATABASE"],
            user=os.environ["MYSQL_USER"],
            password=os.environ["MYSQL_PASSWORD"],
        )


@dataclass(frozen=True)
class CatalogProduct:
    product_id: int
    source: str
    external_id: str
    name: str
    brand: str
    gender: str
    price: int
    category: str
    subcategory: str
    image_url: str
    purchase_url: str
    description: str | None
    currency: str
    availability: str

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "CatalogProduct":
        try:
            product = cls(
                product_id=int(row["id"]),
                source=str(row["source"]),
                external_id=str(row["external_id"]),
                name=str(row["name"]),
                brand=str(row["brand"]),
                gender=str(row["gender"]),
                price=int(row["price"]),
                category=str(row["category"]),
                subcategory=str(row["subcategory"]),
                image_url=str(row["image_url"]),
                purchase_url=str(row["purchase_url"]),
                description=(
                    None
                    if row.get("description") is None
                    else str(row["description"])
                ),
                currency=str(row["currency"]),
                availability=str(row["availability"]),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise CatalogError(f"invalid catalog row: {exc}") from exc
        product.validate()
        return product

    def validate(self) -> None:
        if self.product_id <= 0:
            raise CatalogError("product id must be positive")
        required = {
            "source": self.source,
            "external_id": self.external_id,
            "name": self.name,
            "brand": self.brand,
            "gender": self.gender,
            "category": self.category,
            "subcategory": self.subcategory,
            "image_url": self.image_url,
            "purchase_url": self.purchase_url,
            "currency": self.currency,
        }
        missing = [key for key, value in required.items() if not value.strip()]
        if missing:
            raise CatalogError(
                f"product {self.product_id} missing fields: {missing}"
            )
        if self.price < 0:
            raise CatalogError(
                f"product {self.product_id} has a negative price"
            )
        if self.availability != "AVAILABLE":
            raise CatalogError(
                f"product {self.product_id} is not AVAILABLE"
            )

    def metadata(self) -> dict[str, Any]:
        return asdict(self)


class CatalogRepository(Protocol):
    def load_available(self, *, limit: int | None = None) -> list[CatalogProduct]:
        """Return a stable, product-id ordered AVAILABLE catalog."""


_SELECT_AVAILABLE_PRODUCTS = """
SELECT
    id, source, external_id, name, brand, gender, price, category,
    subcategory, image_url, purchase_url, description, currency, availability
FROM products
WHERE availability = 'AVAILABLE'
ORDER BY id
""".strip()


class MySQLCatalogRepository:
    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def load_available(
        self,
        *,
        limit: int | None = None,
    ) -> list[CatalogProduct]:
        if limit is not None and limit <= 0:
            raise CatalogError("limit must be positive")
        sql = _SELECT_AVAILABLE_PRODUCTS
        params: tuple[int, ...] = ()
        if limit is not None:
            sql = f"{sql}\nLIMIT %s"
            params = (limit,)
        with self._connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        products = [CatalogProduct.from_row(dict(row)) for row in rows]
        _validate_unique_products(products)
        return products


def connect_catalog_database(
    settings: CatalogDatabaseSettings,
) -> Connection:
    try:
        return pymysql.connect(
            host=settings.host,
            port=settings.port,
            user=settings.user,
            password=settings.password,
            database=settings.database,
            charset="utf8mb4",
            cursorclass=DictCursor,
            autocommit=True,
            connect_timeout=10,
            read_timeout=30,
            write_timeout=30,
        )
    except pymysql.MySQLError as exc:
        raise CatalogError(f"cannot connect to catalog database: {exc}") from exc


def _validate_unique_products(products: list[CatalogProduct]) -> None:
    ids = [product.product_id for product in products]
    source_keys = [
        (product.source, product.external_id) for product in products
    ]
    if len(ids) != len(set(ids)):
        raise CatalogError("catalog contains duplicate product ids")
    if len(source_keys) != len(set(source_keys)):
        raise CatalogError(
            "catalog contains duplicate source/external_id values"
        )
