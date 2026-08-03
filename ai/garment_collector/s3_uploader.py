"""Idempotent private S3 uploader for garment primary images."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from garment_collector.seed_manifest import MANIFEST_VERSION
from garment_collector.storage import DatasetStorage

_SAFE_EXTERNAL_ID = re.compile(r"^[A-Za-z0-9._-]+$")
_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class S3UploadError(RuntimeError):
    """Raised for invalid manifests, local files, or S3 object conflicts."""


@dataclass(frozen=True)
class S3Settings:
    region: str
    bucket: str
    image_base_url: str

    @classmethod
    def from_env(cls) -> "S3Settings":
        required = (
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_REGION",
            "GARMENT_S3_BUCKET",
            "GARMENT_IMAGE_BASE_URL",
        )
        missing = [name for name in required if not os.environ.get(name)]
        if missing:
            raise S3UploadError(
                f"missing required environment variables: {missing}"
            )
        return cls(
            region=os.environ["AWS_REGION"],
            bucket=os.environ["GARMENT_S3_BUCKET"],
            image_base_url=os.environ["GARMENT_IMAGE_BASE_URL"],
        )


@dataclass(frozen=True)
class UploadReport:
    checked: int
    uploaded: int
    skipped: int
    dry_run: bool
    manifest: dict[str, Any] | None


@dataclass
class _UploadItem:
    product: dict[str, Any]
    key: str
    content: bytes
    sha256: str
    mime_type: str
    exists: bool = False


def upload_manifest(
    manifest_path: Path,
    dataset_root: Path,
    output_path: Path,
    *,
    client: BaseClient,
    bucket: str,
    image_base_url: str,
    dry_run: bool = False,
) -> UploadReport:
    """Preflight every object, then upload only absent objects.

    A conflict aborts before any PutObject call, so an existing object is never
    overwritten and partial uploads caused by a discovered conflict are avoided.
    """
    manifest = _load_manifest(manifest_path)
    dataset_root = dataset_root.resolve()
    output_path = output_path.resolve()
    items = [
        _build_item(product, dataset_root)
        for product in manifest["products"]
    ]

    skipped = 0
    for item in items:
        head = _head_object(client, bucket, item.key)
        if head is None:
            continue
        remote_size = head.get("ContentLength")
        remote_sha = (head.get("Metadata") or {}).get("sha256")
        if remote_size != len(item.content) or remote_sha != item.sha256:
            raise S3UploadError(
                f"S3 object conflict: s3://{bucket}/{item.key}"
            )
        item.exists = True
        skipped += 1

    if dry_run:
        return UploadReport(
            checked=len(items),
            uploaded=0,
            skipped=skipped,
            dry_run=True,
            manifest=None,
        )

    uploaded = 0
    for item in items:
        if not item.exists:
            client.put_object(
                Bucket=bucket,
                Key=item.key,
                Body=item.content,
                ContentType=item.mime_type,
                Metadata={"sha256": item.sha256},
                ServerSideEncryption="AES256",
            )
            uploaded += 1
        image_url = (
            f"{image_base_url.rstrip('/')}/{quote(item.key, safe='/')}"
        )
        item.product["image_url"] = image_url
        item.product["primary"]["s3_object_key"] = item.key

    manifest.pop("manifest_sha256", None)
    manifest["manifest_sha256"] = DatasetStorage.sha256_json(manifest)
    DatasetStorage.atomic_write_json(output_path, manifest)
    return UploadReport(
        checked=len(items),
        uploaded=uploaded,
        skipped=skipped,
        dry_run=False,
        manifest=manifest,
    )


def create_s3_client(settings: S3Settings) -> BaseClient:
    return boto3.client("s3", region_name=settings.region)


def object_key(external_id: str, sha256: str, extension: str) -> str:
    if not _SAFE_EXTERNAL_ID.fullmatch(external_id):
        raise S3UploadError(f"unsafe external_id: {external_id!r}")
    if len(sha256) != 64 or any(c not in "0123456789abcdef" for c in sha256):
        raise S3UploadError(f"invalid sha256 for {external_id}")
    extension = extension.lower()
    if extension not in _ALLOWED_EXTENSIONS:
        raise S3UploadError(
            f"unsupported image extension for {external_id}: {extension}"
        )
    return (
        f"garments/musinsa/{external_id}/"
        f"primary-{sha256[:16]}{extension}"
    )


def _load_manifest(path: Path) -> dict[str, Any]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise S3UploadError(f"cannot read manifest: {exc}") from exc
    if not isinstance(manifest, dict):
        raise S3UploadError("manifest root must be an object")
    if manifest.get("schema_version") != MANIFEST_VERSION:
        raise S3UploadError(
            f"manifest schema must be {MANIFEST_VERSION}"
        )
    products = manifest.get("products")
    if not isinstance(products, list) or not products:
        raise S3UploadError("manifest products must be a non-empty list")
    if manifest.get("product_count") != len(products):
        raise S3UploadError("manifest product_count mismatch")
    supplied_hash = manifest.get("manifest_sha256")
    hash_input = dict(manifest)
    hash_input.pop("manifest_sha256", None)
    if supplied_hash != DatasetStorage.sha256_json(hash_input):
        raise S3UploadError("manifest_sha256 mismatch")
    return manifest


def _build_item(
    product: dict[str, Any],
    dataset_root: Path,
) -> _UploadItem:
    if not isinstance(product, dict):
        raise S3UploadError("manifest product must be an object")
    external_id = str(product.get("external_id") or "")
    if product.get("source") != "MUSINSA":
        raise S3UploadError(f"{external_id}: source must be MUSINSA")
    primary = product.get("primary")
    if not isinstance(primary, dict):
        raise S3UploadError(f"{external_id}: primary missing")
    local_path = primary.get("local_path")
    sha256 = primary.get("sha256")
    mime_type = primary.get("mime_type")
    if not isinstance(local_path, str):
        raise S3UploadError(f"{external_id}: primary.local_path missing")
    if not isinstance(sha256, str):
        raise S3UploadError(f"{external_id}: primary.sha256 missing")
    if not isinstance(mime_type, str):
        raise S3UploadError(f"{external_id}: primary.mime_type missing")

    image_path = (dataset_root / local_path).resolve()
    try:
        image_path.relative_to(dataset_root)
    except ValueError as exc:
        raise S3UploadError(
            f"{external_id}: primary path escapes dataset root"
        ) from exc
    if not image_path.is_file():
        raise S3UploadError(f"{external_id}: primary image missing")
    content = image_path.read_bytes()
    actual_sha = DatasetStorage.sha256_bytes(content)
    if actual_sha != sha256:
        raise S3UploadError(f"{external_id}: primary sha256 mismatch")
    if primary.get("byte_size") != len(content):
        raise S3UploadError(f"{external_id}: primary byte_size mismatch")

    return _UploadItem(
        product=product,
        key=object_key(external_id, sha256, image_path.suffix),
        content=content,
        sha256=sha256,
        mime_type=mime_type,
    )


def _head_object(
    client: BaseClient,
    bucket: str,
    key: str,
) -> dict[str, Any] | None:
    try:
        return client.head_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        status = exc.response.get("ResponseMetadata", {}).get(
            "HTTPStatusCode"
        )
        if code in {"404", "NoSuchKey", "NotFound"} or status == 404:
            return None
        raise S3UploadError(
            f"HeadObject failed for s3://{bucket}/{key}: {code}"
        ) from exc
