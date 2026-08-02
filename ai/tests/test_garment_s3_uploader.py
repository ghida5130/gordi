from __future__ import annotations

import hashlib
import json
from pathlib import Path

import boto3
from botocore.stub import Stubber
import pytest

from garment_collector.s3_uploader import (
    S3UploadError,
    object_key,
    upload_manifest,
)
from garment_collector.storage import DatasetStorage

BUCKET = "private-garments"
BASE_URL = "https://garments.internal.example"
EXTERNAL_ID = "123"


def _client():
    return boto3.client(
        "s3",
        region_name="ap-northeast-2",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def _manifest_fixture(tmp_path: Path) -> tuple[Path, Path, bytes, str, str]:
    dataset_root = tmp_path / "dataset"
    image_path = dataset_root / "images" / "musinsa" / "123" / "primary.jpg"
    image_path.parent.mkdir(parents=True)
    content = b"deterministic-primary-image-bytes"
    image_path.write_bytes(content)
    digest = hashlib.sha256(content).hexdigest()
    key = object_key(EXTERNAL_ID, digest, ".jpg")
    manifest = {
        "schema_version": "gordi-product-seed-v1",
        "product_count": 1,
        "size_row_count": 1,
        "products": [
            {
                "source": "MUSINSA",
                "external_id": EXTERNAL_ID,
                "primary": {
                    "local_path": "images/musinsa/123/primary.jpg",
                    "sha256": digest,
                    "mime_type": "image/jpeg",
                    "byte_size": len(content),
                },
            }
        ],
    }
    manifest["manifest_sha256"] = DatasetStorage.sha256_json(manifest)
    manifest_path = tmp_path / "seed.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    return manifest_path, dataset_root, content, digest, key


def test_upload_s3_uploads_absent_object_with_private_metadata(
    tmp_path: Path,
) -> None:
    manifest_path, dataset_root, content, digest, key = _manifest_fixture(
        tmp_path
    )
    output = tmp_path / "uploaded.json"
    client = _client()
    with Stubber(client) as stubber:
        stubber.add_client_error(
            "head_object",
            service_error_code="404",
            service_message="Not Found",
            http_status_code=404,
            expected_params={"Bucket": BUCKET, "Key": key},
        )
        stubber.add_response(
            "put_object",
            {"ETag": '"etag"'},
            {
                "Bucket": BUCKET,
                "Key": key,
                "Body": content,
                "ContentType": "image/jpeg",
                "Metadata": {"sha256": digest},
                "ServerSideEncryption": "AES256",
            },
        )
        report = upload_manifest(
            manifest_path,
            dataset_root,
            output,
            client=client,
            bucket=BUCKET,
            image_base_url=BASE_URL,
        )

    assert report.uploaded == 1
    assert report.skipped == 0
    product = report.manifest["products"][0]
    assert product["primary"]["s3_object_key"] == key
    assert product["image_url"] == f"{BASE_URL}/{key}"
    assert output.is_file()


def test_upload_s3_skips_identical_object_on_rerun(tmp_path: Path) -> None:
    manifest_path, dataset_root, content, digest, key = _manifest_fixture(
        tmp_path
    )
    output = tmp_path / "rerun.json"
    client = _client()
    with Stubber(client) as stubber:
        stubber.add_response(
            "head_object",
            {
                "ContentLength": len(content),
                "Metadata": {"sha256": digest},
            },
            {"Bucket": BUCKET, "Key": key},
        )
        report = upload_manifest(
            manifest_path,
            dataset_root,
            output,
            client=client,
            bucket=BUCKET,
            image_base_url=BASE_URL,
        )

    assert report.uploaded == 0
    assert report.skipped == 1
    assert output.is_file()


def test_upload_s3_fails_without_overwrite_on_conflict(
    tmp_path: Path,
) -> None:
    manifest_path, dataset_root, content, digest, key = _manifest_fixture(
        tmp_path
    )
    output = tmp_path / "conflict.json"
    client = _client()
    with Stubber(client) as stubber:
        stubber.add_response(
            "head_object",
            {
                "ContentLength": len(content) + 1,
                "Metadata": {"sha256": digest},
            },
            {"Bucket": BUCKET, "Key": key},
        )
        with pytest.raises(S3UploadError, match="object conflict"):
            upload_manifest(
                manifest_path,
                dataset_root,
                output,
                client=client,
                bucket=BUCKET,
                image_base_url=BASE_URL,
            )

    assert not output.exists()
