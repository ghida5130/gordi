"""Image inspect helpers (MIME, size, dimensions)."""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image

from garment_collector.config import MIN_IMAGE_EDGE_PX


@dataclass(frozen=True)
class InspectedImage:
    content: bytes
    width: int
    height: int
    mime_type: str
    extension: str
    byte_size: int
    sha256: str


_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def inspect_image(content: bytes, sha256: str) -> InspectedImage:
    with Image.open(io.BytesIO(content)) as img:
        img.load()
        width, height = img.size
        fmt = (img.format or "").upper()

    mime_type = {
        "JPEG": "image/jpeg",
        "PNG": "image/png",
        "WEBP": "image/webp",
    }.get(fmt)
    if mime_type is None:
        raise ValueError(f"unsupported image format: {fmt or 'unknown'}")

    if width < MIN_IMAGE_EDGE_PX or height < MIN_IMAGE_EDGE_PX:
        raise ValueError(
            f"image too small: {width}x{height} "
            f"(min edge {MIN_IMAGE_EDGE_PX}px)"
        )

    return InspectedImage(
        content=content,
        width=width,
        height=height,
        mime_type=mime_type,
        extension=_MIME_TO_EXT[mime_type],
        byte_size=len(content),
        sha256=sha256,
    )
