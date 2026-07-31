"""Transactional, target-scoped MySQL seeder for uploaded garment manifests."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable

import pymysql
from pymysql.connections import Connection
from pymysql.cursors import DictCursor

from garment_collector.models import BackendCategory, BackendSubcategory, Gender
from garment_collector.seed_manifest import (
    EXPECTED_PRODUCT_COUNT,
    EXPECTED_SIZE_ROW_COUNT,
    MANIFEST_VERSION,
)
from garment_collector.storage import DatasetStorage

_PRODUCT_COLUMNS = {
    "id",
    "name",
    "brand",
    "source",
    "external_id",
    "gender",
    "price",
    "category",
    "subcategory",
    "image_url",
    "purchase_url",
    "description",
    "currency",
    "availability",
}
_TOP_SIZE_COLUMNS = {
    "id",
    "products_id",
    "size_name",
    "total_length",
    "shoulder_width",
    "chest_width",
    "sleeve_length",
}
_BOTTOM_SIZE_COLUMNS = {
    "id",
    "products_id",
    "size_name",
    "total_length",
    "waist_width",
    "hip_width",
    "thigh_width",
    "rise",
}
_CATEGORY_SUBCATEGORIES = {
    BackendCategory.TOP: {
        BackendSubcategory.SHORT_SLEEVE,
        BackendSubcategory.LONG_SLEEVE,
        BackendSubcategory.SHIRT,
        BackendSubcategory.KNIT,
        BackendSubcategory.HOODIE,
        BackendSubcategory.SLEEVELESS,
        BackendSubcategory.SPORTS_TOP,
        BackendSubcategory.OTHER_TOP,
        BackendSubcategory.DRESS,
    },
    BackendCategory.BOTTOM: {
        BackendSubcategory.DENIM_PANTS,
        BackendSubcategory.SLACKS,
        BackendSubcategory.SHORTS,
        BackendSubcategory.SKIRT,
        BackendSubcategory.COTTON_PANTS,
        BackendSubcategory.JOGGER_PANTS,
        BackendSubcategory.SPORTS_BOTTOM,
        BackendSubcategory.OTHER_BOTTOM,
    },
}

_PRODUCT_UPSERT = """
INSERT INTO products (
    name, brand, source, external_id, gender, price, category, subcategory,
    image_url, purchase_url, description, currency, availability
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    brand = VALUES(brand),
    gender = VALUES(gender),
    price = VALUES(price),
    category = VALUES(category),
    subcategory = VALUES(subcategory),
    image_url = VALUES(image_url),
    purchase_url = VALUES(purchase_url),
    description = VALUES(description),
    currency = VALUES(currency),
    availability = VALUES(availability)
""".strip()


class SeedError(RuntimeError):
    """Raised when schema, manifest, backup, or transaction validation fails."""


@dataclass(frozen=True)
class MySQLSettings:
    host: str
    port: int
    database: str
    user: str
    password: str

    @classmethod
    def from_env(cls) -> "MySQLSettings":
        required = (
            "MYSQL_HOST",
            "MYSQL_DATABASE",
            "MYSQL_USER",
            "MYSQL_PASSWORD",
        )
        missing = [name for name in required if not os.environ.get(name)]
        if missing:
            raise SeedError(
                f"missing required environment variables: {missing}"
            )
        try:
            port = int(os.environ.get("MYSQL_PORT", "3306"))
        except ValueError as exc:
            raise SeedError("MYSQL_PORT must be an integer") from exc
        return cls(
            host=os.environ["MYSQL_HOST"],
            port=port,
            database=os.environ["MYSQL_DATABASE"],
            user=os.environ["MYSQL_USER"],
            password=os.environ["MYSQL_PASSWORD"],
        )


@dataclass(frozen=True)
class SeedReport:
    product_count: int
    size_row_count: int
    existing_product_count: int
    applied: bool
    backup_output: str | None


def connect_database(settings: MySQLSettings) -> Connection:
    return pymysql.connect(
        host=settings.host,
        port=settings.port,
        user=settings.user,
        password=settings.password,
        database=settings.database,
        charset="utf8mb4",
        autocommit=False,
        connect_timeout=10,
        cursorclass=DictCursor,
    )


def load_uploaded_manifest(
    path: Path,
    *,
    image_base_url: str,
    expected_product_count: int = EXPECTED_PRODUCT_COUNT,
    expected_size_row_count: int = EXPECTED_SIZE_ROW_COUNT,
) -> dict[str, Any]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SeedError(f"cannot read manifest: {exc}") from exc
    if not isinstance(manifest, dict):
        raise SeedError("manifest root must be an object")
    if manifest.get("schema_version") != MANIFEST_VERSION:
        raise SeedError(f"manifest schema must be {MANIFEST_VERSION}")
    supplied_hash = manifest.get("manifest_sha256")
    hash_input = dict(manifest)
    hash_input.pop("manifest_sha256", None)
    if supplied_hash != DatasetStorage.sha256_json(hash_input):
        raise SeedError("manifest_sha256 mismatch")
    products = manifest.get("products")
    if not isinstance(products, list) or not products:
        raise SeedError("manifest products must be a non-empty list")
    if manifest.get("product_count") != len(products):
        raise SeedError("manifest product_count mismatch")
    if len(products) != expected_product_count:
        raise SeedError(
            f"expected {expected_product_count} products, got {len(products)}"
        )

    expected_size_rows = 0
    seen: set[tuple[str, str]] = set()
    prefix = f"{image_base_url.rstrip('/')}/"
    for product in products:
        _validate_product(product, prefix)
        key = (product["source"], product["external_id"])
        if key in seen:
            raise SeedError(f"duplicate source/external_id: {key}")
        seen.add(key)
        expected_size_rows += len(product["sizes"])
    if manifest.get("size_row_count") != expected_size_rows:
        raise SeedError("manifest size_row_count mismatch")
    if expected_size_rows != expected_size_row_count:
        raise SeedError(
            f"expected {expected_size_row_count} size rows, "
            f"got {expected_size_rows}"
        )
    return manifest


def seed_database(
    connection: Connection,
    manifest: dict[str, Any],
    *,
    database: str,
    apply: bool,
    backup_output: Path | None = None,
) -> SeedReport:
    products = manifest["products"]
    external_ids = [product["external_id"] for product in products]
    size_row_count = sum(len(product["sizes"]) for product in products)

    try:
        with connection.cursor() as cursor:
            validate_schema(cursor, database)
            existing_count = _count_target_products(cursor, external_ids)
            if not apply:
                connection.rollback()
                return SeedReport(
                    product_count=len(products),
                    size_row_count=size_row_count,
                    existing_product_count=existing_count,
                    applied=False,
                    backup_output=None,
                )
            if backup_output is None:
                raise SeedError("--backup-output is required with --apply")
            backup = _read_target_backup(cursor, external_ids)
        connection.rollback()
        DatasetStorage.atomic_write_json(backup_output.resolve(), backup)

        connection.begin()
        with connection.cursor() as cursor:
            for product in products:
                _upsert_product_and_sizes(cursor, product)
            actual_products = _count_target_products(cursor, external_ids)
            actual_sizes = _count_target_sizes(cursor, external_ids)
            if actual_products != len(products):
                raise SeedError(
                    f"transaction product count mismatch: {actual_products}"
                )
            if actual_sizes != size_row_count:
                raise SeedError(
                    f"transaction size row count mismatch: {actual_sizes}"
                )
        connection.commit()
        return SeedReport(
            product_count=len(products),
            size_row_count=size_row_count,
            existing_product_count=existing_count,
            applied=True,
            backup_output=str(backup_output.resolve()),
        )
    except Exception as exc:
        connection.rollback()
        if isinstance(exc, SeedError):
            raise
        raise SeedError(f"database seed failed: {exc}") from exc


def validate_schema(cursor: Any, database: str) -> None:
    expected = {
        "products": _PRODUCT_COLUMNS,
        "product_top_sizes": _TOP_SIZE_COLUMNS,
        "product_bottom_sizes": _BOTTOM_SIZE_COLUMNS,
    }
    for table, required_columns in expected.items():
        cursor.execute(
            """
            SELECT COLUMN_NAME, IS_NULLABLE
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            """,
            (database, table),
        )
        rows = list(cursor.fetchall())
        actual = {str(row["COLUMN_NAME"]).lower() for row in rows}
        missing = sorted(required_columns - actual)
        if missing:
            raise SeedError(f"{table} missing columns: {missing}")
        if table == "products":
            nullable = {
                str(row["COLUMN_NAME"]).lower(): str(row["IS_NULLABLE"]).upper()
                for row in rows
            }
            nullable_required = sorted(
                column
                for column in ("source", "external_id", "gender")
                if nullable.get(column) != "NO"
            )
            if nullable_required:
                raise SeedError(
                    "products columns must be non-null: "
                    f"{nullable_required}"
                )

    cursor.execute(
        """
        SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
        FROM information_schema.statistics
        WHERE table_schema = %s
          AND table_name = 'products'
          AND NON_UNIQUE = 0
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
        """,
        (database,),
    )
    indexes: dict[str, list[str]] = {}
    for row in cursor.fetchall():
        indexes.setdefault(str(row["INDEX_NAME"]), []).append(
            str(row["COLUMN_NAME"]).lower()
        )
    if ["source", "external_id"] not in indexes.values():
        raise SeedError(
            "products requires unique index on (source, external_id)"
        )


def product_upsert_statement(
    product: dict[str, Any],
) -> tuple[str, tuple[Any, ...]]:
    return _PRODUCT_UPSERT, (
        product["name"],
        product["brand"],
        product["source"],
        product["external_id"],
        product["gender"],
        product["price"],
        product["category"],
        product["subcategory"],
        product["image_url"],
        product["purchase_url"],
        product.get("description"),
        product["currency"],
        product["availability"],
    )


def _upsert_product_and_sizes(cursor: Any, product: dict[str, Any]) -> None:
    sql, params = product_upsert_statement(product)
    cursor.execute(sql, params)
    cursor.execute(
        "SELECT id FROM products WHERE source = %s AND external_id = %s",
        (product["source"], product["external_id"]),
    )
    row = cursor.fetchone()
    if not row or row.get("id") is None:
        raise SeedError(
            f"{product['external_id']}: cannot resolve product id"
        )
    product_id = row["id"]
    cursor.execute(
        "DELETE FROM product_top_sizes WHERE products_id = %s",
        (product_id,),
    )
    cursor.execute(
        "DELETE FROM product_bottom_sizes WHERE products_id = %s",
        (product_id,),
    )
    for size in product["sizes"]:
        sql, params = _size_insert_statement(product, product_id, size)
        cursor.execute(sql, params)


def _size_insert_statement(
    product: dict[str, Any],
    product_id: int,
    size: dict[str, Any],
) -> tuple[str, tuple[Any, ...]]:
    measurements = size["measurements_cm"]
    if product["category"] == BackendCategory.TOP.value:
        return (
            """
            INSERT INTO product_top_sizes (
                products_id, size_name, total_length, shoulder_width,
                chest_width, sleeve_length
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """.strip(),
            (
                product_id,
                size["size_name"],
                _decimal(measurements["total_length"]),
                _decimal(measurements["shoulder_width"]),
                _decimal(measurements["chest_width"]),
                _decimal(measurements.get("sleeve_length")),
            ),
        )
    return (
        """
        INSERT INTO product_bottom_sizes (
            products_id, size_name, total_length, waist_width,
            hip_width, thigh_width, rise
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """.strip(),
        (
            product_id,
            size["size_name"],
            _decimal(measurements["total_length"]),
            _decimal(measurements["waist_width"]),
            _decimal(measurements["hip_width"]),
            _decimal(measurements.get("thigh_width")),
            _decimal(measurements.get("rise")),
        ),
    )


def _validate_product(product: Any, image_url_prefix: str) -> None:
    if not isinstance(product, dict):
        raise SeedError("manifest product must be an object")
    external_id = str(product.get("external_id") or "")
    if product.get("source") != "MUSINSA" or not external_id:
        raise SeedError(f"{external_id}: invalid source/external_id")
    try:
        Gender(product.get("gender"))
        category = BackendCategory(product.get("category"))
        subcategory = BackendSubcategory(product.get("subcategory"))
    except ValueError as exc:
        raise SeedError(f"{external_id}: invalid backend enum") from exc
    if (
        category not in _CATEGORY_SUBCATEGORIES
        or subcategory not in _CATEGORY_SUBCATEGORIES[category]
    ):
        raise SeedError(
            f"{external_id}: category/subcategory combination invalid"
        )
    if product.get("availability") != "AVAILABLE":
        raise SeedError(f"{external_id}: availability must be AVAILABLE")
    if (
        not isinstance(product.get("price"), int)
        or isinstance(product.get("price"), bool)
        or product["price"] < 0
    ):
        raise SeedError(f"{external_id}: price invalid")
    if product.get("currency") != "KRW":
        raise SeedError(f"{external_id}: currency must be KRW")
    purchase_url = product.get("purchase_url")
    if not isinstance(purchase_url, str) or not purchase_url.startswith(
        "https://"
    ):
        raise SeedError(f"{external_id}: purchase_url invalid")
    image_url = product.get("image_url")
    if not isinstance(image_url, str) or not image_url.startswith(
        image_url_prefix
    ):
        raise SeedError(f"{external_id}: internal image_url missing")
    primary = product.get("primary")
    sha256 = str(primary.get("sha256") or "") if isinstance(primary, dict) else ""
    object_key = (
        str(primary.get("s3_object_key") or "")
        if isinstance(primary, dict)
        else ""
    )
    if (
        not isinstance(primary, dict)
        or len(sha256) != 64
        or any(character not in "0123456789abcdef" for character in sha256)
        or not object_key.startswith(
            f"garments/musinsa/{external_id}/primary-{sha256[:16]}."
        )
    ):
        raise SeedError(f"{external_id}: S3 primary metadata missing")
    if image_url != f"{image_url_prefix}{object_key}":
        raise SeedError(f"{external_id}: image_url/object key mismatch")
    sizes = product.get("sizes")
    if not isinstance(sizes, list) or not sizes:
        raise SeedError(f"{external_id}: sizes missing")
    required = (
        ("total_length", "shoulder_width", "chest_width")
        if category == BackendCategory.TOP
        else ("total_length", "waist_width", "hip_width")
    )
    size_names: set[str] = set()
    for size in sizes:
        if not isinstance(size, dict) or not str(size.get("size_name") or ""):
            raise SeedError(f"{external_id}: size row invalid")
        size_name = str(size["size_name"])
        if size_name in size_names:
            raise SeedError(
                f"{external_id}: duplicate size_name {size_name}"
            )
        size_names.add(size_name)
        measurements = size.get("measurements_cm")
        if not isinstance(measurements, dict):
            raise SeedError(f"{external_id}: measurements missing")
        for value in measurements.values():
            _decimal(value)
        if any(_decimal(measurements.get(field)) is None for field in required):
            raise SeedError(
                f"{external_id} {size['size_name']}: required size missing"
            )


def _decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise SeedError(f"invalid decimal value: {value}") from exc
    if not result.is_finite() or result <= 0 or result.as_tuple().exponent < -2:
        raise SeedError(f"invalid two-decimal measurement: {value}")
    return result


def _target_where(external_ids: Iterable[str]) -> tuple[str, tuple[Any, ...]]:
    ids = tuple(external_ids)
    if not ids:
        raise SeedError("target external_ids empty")
    placeholders = ", ".join(["%s"] * len(ids))
    return (
        f"p.source = %s AND p.external_id IN ({placeholders})",
        ("MUSINSA", *ids),
    )


def _count_target_products(cursor: Any, external_ids: list[str]) -> int:
    where, params = _target_where(external_ids)
    cursor.execute(
        f"SELECT COUNT(*) AS row_count FROM products p WHERE {where}",
        params,
    )
    row = cursor.fetchone()
    return int(row["row_count"])


def _count_target_sizes(cursor: Any, external_ids: list[str]) -> int:
    where, params = _target_where(external_ids)
    total = 0
    for table in ("product_top_sizes", "product_bottom_sizes"):
        cursor.execute(
            f"""
            SELECT COUNT(*) AS row_count
            FROM {table} s
            JOIN products p ON p.id = s.products_id
            WHERE {where}
            """,
            params,
        )
        total += int(cursor.fetchone()["row_count"])
    return total


def _read_target_backup(
    cursor: Any,
    external_ids: list[str],
) -> dict[str, Any]:
    where, params = _target_where(external_ids)
    cursor.execute(f"SELECT p.* FROM products p WHERE {where}", params)
    products = list(cursor.fetchall())
    sizes: dict[str, list[dict[str, Any]]] = {}
    for table in ("product_top_sizes", "product_bottom_sizes"):
        cursor.execute(
            f"""
            SELECT s.*
            FROM {table} s
            JOIN products p ON p.id = s.products_id
            WHERE {where}
            """,
            params,
        )
        sizes[table] = list(cursor.fetchall())
    return {
        "source": "MUSINSA",
        "external_ids": external_ids,
        "products": products,
        **sizes,
    }
