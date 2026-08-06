from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageDraw, ImageFont, ImageOps


ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def normalize_image(data: bytes, *, max_edge: int = 2048) -> bytes:
    with Image.open(BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        output = BytesIO()
        image.save(output, format="PNG", optimize=True)
        return output.getvalue()


def make_reference_sheet(avatar: bytes, garments: list[bytes]) -> bytes:
    canvas = Image.new("RGB", (768, 1152), "#f5f1e8")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=18)

    def paste_panel(data: bytes, box: tuple[int, int, int, int], label: str) -> None:
        with Image.open(BytesIO(data)) as source:
            image = source.convert("RGB")
            fitted = ImageOps.contain(image, (box[2] - box[0] - 28, box[3] - box[1] - 54))
            x = box[0] + (box[2] - box[0] - fitted.width) // 2
            y = box[1] + 36 + (box[3] - box[1] - 54 - fitted.height) // 2
            draw.rounded_rectangle(box, radius=20, fill="white", outline="#d8d0c2", width=2)
            draw.text((box[0] + 14, box[1] + 12), label, fill="#1b1b1b", font=font)
            canvas.paste(fitted, (x, y))

    paste_panel(avatar, (24, 24, 474, 1128), "PERSON BASE")
    panel_height = (1104 - (len(garments) - 1) * 12) // max(len(garments), 1)
    for index, garment in enumerate(garments):
        top = 24 + index * (panel_height + 12)
        paste_panel(
            garment,
            (494, top, 744, top + panel_height),
            f"GARMENT {index + 1}",
        )

    output = BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def make_role_labeled_reference(
    data: bytes,
    *,
    role: str,
    subtitle: str,
) -> bytes:
    """Add an explicit visual role without reducing source garment resolution."""

    with Image.open(BytesIO(data)) as source:
        image = source.convert("RGB")

    canvas_width = max(image.width, 768)
    banner_height = 112
    canvas = Image.new("RGB", (canvas_width, image.height + banner_height), "white")
    x = (canvas_width - image.width) // 2
    canvas.paste(image, (x, banner_height))

    draw = ImageDraw.Draw(canvas)
    role_font = ImageFont.load_default(size=24)
    subtitle_font = ImageFont.load_default(size=17)
    is_person = role == "PERSON BASE"
    background = "#173f35" if is_person else "#8e2f24"
    draw.rectangle((0, 0, canvas_width, banner_height), fill=background)
    draw.text((24, 18), role, fill="white", font=role_font)
    draw.text((24, 64), subtitle, fill="#fff6e9", font=subtitle_font)

    output = BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def make_mock_output(avatar: bytes, candidate_number: int) -> bytes:
    with Image.open(BytesIO(avatar)) as source:
        image = ImageOps.fit(source.convert("RGB"), (768, 1152), Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    hue = [(234, 97, 81), (75, 110, 221), (35, 154, 112), (151, 92, 184)][
        candidate_number % 4
    ]
    draw.rectangle((0, 0, 768, 96), fill=(*hue, 225))
    draw.text((28, 28), f"MOCK OUTPUT {candidate_number + 1}", fill="white")
    draw.rectangle((0, 1060, 768, 1152), fill=(20, 20, 20, 220))
    draw.text((28, 1092), "API NOT CALLED - UI TEST ONLY", fill="white")
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    output = BytesIO()
    image.save(output, format="JPEG", quality=90)
    return output.getvalue()
