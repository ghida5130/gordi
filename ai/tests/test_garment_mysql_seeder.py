from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

import garment_collector.mysql_seeder as seeder
from garment_collector.mysql_seeder import (
    SeedError,
    load_uploaded_manifest,
    product_upsert_statement,
    seed_database,
)
from garment_collector.storage import DatasetStorage

BASE_URL = "https://garments.internal.example"


def _product() -> dict[str, Any]:
    return {
        "source": "MUSINSA",
        "external_id": "123",
        "name": "테스트 티셔츠",
        "brand": "테스트",
        "gender": "MALE",
        "category": "TOP",
        "subcategory": "SHORT_SLEEVE",
        "price": 39000,
        "currency": "KRW",
        "availability": "AVAILABLE",
        "purchase_url": "https://www.musinsa.com/products/123",
        "image_url": (
            f"{BASE_URL}/garments/musinsa/123/primary-0000000000000000.jpg"
        ),
        "description": "테스트",
        "primary": {
            "sha256": "0" * 64,
            "s3_object_key": (
                "garments/musinsa/123/primary-0000000000000000.jpg"
            ),
        },
        "sizes": [
            {
                "size_name": "M",
                "measurements_cm": {
                    "total_length": "70.00",
                    "shoulder_width": "48.00",
                    "chest_width": "55.00",
                    "sleeve_length": "22.50",
                    "waist_width": None,
                    "hip_width": None,
                    "thigh_width": None,
                    "rise": None,
                    "inseam": None,
                    "hem_width": None,
                },
            }
        ],
    }


def _manifest() -> dict[str, Any]:
    payload = {
        "schema_version": "gordi-product-seed-v1",
        "product_count": 1,
        "size_row_count": 1,
        "products": [_product()],
    }
    payload["manifest_sha256"] = DatasetStorage.sha256_json(payload)
    return payload


class _Cursor:
    def __init__(self, *, fail_on_size_insert: bool = False) -> None:
        self.fail_on_size_insert = fail_on_size_insert
        self.statements: list[tuple[str, Any]] = []
        self._row: dict[str, Any] | None = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, sql: str, params: Any = None) -> None:
        normalized = " ".join(sql.split())
        self.statements.append((normalized, params))
        if normalized.startswith("SELECT id FROM products"):
            self._row = {"id": 7}
        if (
            self.fail_on_size_insert
            and normalized.startswith("INSERT INTO product_top_sizes")
        ):
            raise RuntimeError("simulated size insert failure")

    def fetchone(self):
        return self._row


class _Connection:
    def __init__(self, *, fail_on_size_insert: bool = False) -> None:
        self.cursor_instance = _Cursor(
            fail_on_size_insert=fail_on_size_insert
        )
        self.begin_calls = 0
        self.commit_calls = 0
        self.rollback_calls = 0

    def cursor(self):
        return self.cursor_instance

    def begin(self) -> None:
        self.begin_calls += 1

    def commit(self) -> None:
        self.commit_calls += 1

    def rollback(self) -> None:
        self.rollback_calls += 1


def _patch_database_reads(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(seeder, "validate_schema", lambda *_args: None)
    monkeypatch.setattr(
        seeder,
        "_count_target_products",
        lambda *_args: 1,
    )
    monkeypatch.setattr(
        seeder,
        "_count_target_sizes",
        lambda *_args: 1,
    )
    monkeypatch.setattr(
        seeder,
        "_read_target_backup",
        lambda *_args: {
            "source": "MUSINSA",
            "external_ids": ["123"],
            "products": [],
            "product_top_sizes": [],
            "product_bottom_sizes": [],
        },
    )


def test_uploaded_manifest_and_product_upsert_sql(tmp_path: Path) -> None:
    path = tmp_path / "uploaded.json"
    path.write_text(
        json.dumps(_manifest(), ensure_ascii=False),
        encoding="utf-8",
    )

    manifest = load_uploaded_manifest(
        path,
        image_base_url=BASE_URL,
        expected_product_count=1,
        expected_size_row_count=1,
    )
    sql, params = product_upsert_statement(manifest["products"][0])

    assert "ON DUPLICATE KEY UPDATE" in sql
    assert "source, external_id" in sql
    assert params[2:5] == ("MUSINSA", "123", "MALE")
    assert params[8].startswith(f"{BASE_URL}/")


def test_seed_database_rolls_back_entire_transaction(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_database_reads(monkeypatch)
    connection = _Connection(fail_on_size_insert=True)

    with pytest.raises(SeedError, match="simulated size insert failure"):
        seed_database(
            connection,
            _manifest(),
            database="gordi",
            apply=True,
            backup_output=tmp_path / "backup.json",
        )

    assert connection.begin_calls == 1
    assert connection.commit_calls == 0
    # One rollback closes the backup read transaction, one rolls back DML.
    assert connection.rollback_calls == 2
    assert (tmp_path / "backup.json").is_file()


def test_seed_database_dry_run_executes_no_dml(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_database_reads(monkeypatch)
    connection = _Connection()

    report = seed_database(
        connection,
        _manifest(),
        database="gordi",
        apply=False,
    )

    assert report.applied is False
    assert connection.begin_calls == 0
    assert connection.commit_calls == 0
    assert connection.rollback_calls == 1
    assert connection.cursor_instance.statements == []


def test_seed_database_rerun_uses_same_target_scoped_upsert(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_database_reads(monkeypatch)
    connection = _Connection()

    first = seed_database(
        connection,
        _manifest(),
        database="gordi",
        apply=True,
        backup_output=tmp_path / "backup-first.json",
    )
    second = seed_database(
        connection,
        _manifest(),
        database="gordi",
        apply=True,
        backup_output=tmp_path / "backup-second.json",
    )

    assert first.product_count == second.product_count == 1
    assert first.size_row_count == second.size_row_count == 1
    assert connection.commit_calls == 2
    upserts = [
        sql
        for sql, _params in connection.cursor_instance.statements
        if sql.startswith("INSERT INTO products")
    ]
    deletes = [
        (sql, params)
        for sql, params in connection.cursor_instance.statements
        if sql.startswith("DELETE FROM product_")
    ]
    assert len(upserts) == 2
    assert all("ON DUPLICATE KEY UPDATE" in sql for sql in upserts)
    assert len(deletes) == 4
    assert all(params == (7,) for _sql, params in deletes)


def test_uploaded_manifest_rejects_external_image_url(
    tmp_path: Path,
) -> None:
    manifest = _manifest()
    manifest["products"][0]["image_url"] = "https://public.example/image.jpg"
    manifest.pop("manifest_sha256")
    manifest["manifest_sha256"] = DatasetStorage.sha256_json(manifest)
    path = tmp_path / "bad-url.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(SeedError, match="internal image_url missing"):
        load_uploaded_manifest(
            path,
            image_base_url=BASE_URL,
            expected_product_count=1,
            expected_size_row_count=1,
        )
