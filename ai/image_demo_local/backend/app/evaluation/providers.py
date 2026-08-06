from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import Settings
from app.evaluation.images import make_reference_sheet, make_role_labeled_reference
from app.evaluation.models import AvatarProfile, EvaluationRound, GarmentMetadata
from app.evaluation.profiles import evaluation_profile
from app.evaluation.prompt import build_canonical_prompt, build_prompt


@dataclass(frozen=True)
class ImageInput:
    filename: str
    content: bytes
    mime_type: str = "image/png"


@dataclass(frozen=True)
class ProviderResult:
    provider_id: str
    model: str
    image: bytes
    mime_type: str
    latency_ms: int
    input_strategy: str
    generation_id: str | None = None
    generation_time_ms: int | None = None
    gateway_latency_ms: int | None = None
    provider_name: str | None = None
    cost_usd: float | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class ProviderUnavailable(RuntimeError):
    def __init__(self, message: str, *, category: str = "NOT_CONFIGURED") -> None:
        super().__init__(message)
        self.category = category


class BaseProvider:
    provider_id: str
    display_name: str
    model: str
    input_strategy: str = "multi-reference"
    is_fallback: bool = False

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def configured(self) -> bool:
        raise NotImplementedError

    async def generate(
        self,
        avatar: ImageInput,
        garments: list[ImageInput],
        metadata: list[GarmentMetadata],
        avatar_profile: AvatarProfile | None = None,
    ) -> ProviderResult:
        raise NotImplementedError

    def _result(
        self,
        image: bytes,
        started: float,
        mime_type: str = "image/png",
        *,
        latency_ms: int | None = None,
        generation_id: str | None = None,
        generation_time_ms: int | None = None,
        gateway_latency_ms: int | None = None,
        provider_name: str | None = None,
        cost_usd: float | None = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        total_tokens: int | None = None,
        input_strategy: str | None = None,
    ) -> ProviderResult:
        return ProviderResult(
            provider_id=self.provider_id,
            model=self.model,
            image=image,
            mime_type=mime_type,
            latency_ms=latency_ms
            if latency_ms is not None
            else round((time.perf_counter() - started) * 1000),
            input_strategy=input_strategy or self.input_strategy,
            generation_id=generation_id,
            generation_time_ms=generation_time_ms,
            gateway_latency_ms=gateway_latency_ms,
            provider_name=provider_name,
            cost_usd=cost_usd,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )


def _decode_first_image(payload: dict[str, Any]) -> tuple[bytes, str]:
    direct = payload.get("output_image")
    if isinstance(direct, dict) and direct.get("data"):
        return base64.b64decode(direct["data"]), direct.get("mime_type", "image/png")

    for item in payload.get("data", []):
        if isinstance(item, dict) and item.get("b64_json"):
            return base64.b64decode(item["b64_json"]), item.get(
                "media_type", "image/png"
            )

    def walk(value: Any) -> tuple[bytes, str] | None:
        if isinstance(value, dict):
            if value.get("type") in {"image", "output_image"} and value.get("data"):
                return (
                    base64.b64decode(value["data"]),
                    value.get("mime_type", "image/png"),
                )
            for nested in value.values():
                result = walk(nested)
                if result:
                    return result
        elif isinstance(value, list):
            for nested in value:
                result = walk(nested)
                if result:
                    return result
        return None

    found = walk(payload)
    if not found:
        raise RuntimeError("Provider response did not contain an image")
    return found


def _number(value: Any, cast: type[int] | type[float]) -> int | float | None:
    try:
        return cast(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _openrouter_metrics(
    payload: dict[str, Any],
    metadata: dict[str, Any],
    generation_id: str | None,
) -> dict[str, Any]:
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
    cost = usage.get("cost")
    if cost is None:
        cost = metadata.get("total_cost")
    return {
        "generation_id": generation_id,
        "generation_time_ms": _number(metadata.get("generation_time"), int),
        "gateway_latency_ms": _number(metadata.get("latency"), int),
        "provider_name": metadata.get("provider_name"),
        "cost_usd": _number(cost, float),
        "prompt_tokens": _number(usage.get("prompt_tokens"), int),
        "completion_tokens": _number(usage.get("completion_tokens"), int),
        "total_tokens": _number(usage.get("total_tokens"), int),
    }


class OpenRouterImageProvider(BaseProvider):
    """Adapter for OpenRouter's unified POST /api/v1/images endpoint."""

    def __init__(
        self,
        settings: Settings,
        *,
        provider_id: str,
        display_name: str,
        model: str | None,
        reference_sheet: bool = False,
        max_input_references: int | None = None,
        supports_aspect_ratio: bool = True,
        supports_n: bool = True,
        evaluation_round: EvaluationRound = "ROUND_1",
        role_labeled_references: bool = False,
    ) -> None:
        super().__init__(settings)
        self.provider_id = provider_id
        self.display_name = display_name
        self._model_id = model.strip() if model else None
        self.model = self._model_id or "unavailable-on-openrouter"
        self.reference_sheet = reference_sheet
        self.max_input_references = max_input_references
        self.supports_aspect_ratio = supports_aspect_ratio
        self.supports_n = supports_n
        self.evaluation_round = evaluation_round
        self.role_labeled_references = role_labeled_references
        if reference_sheet:
            self.input_strategy = "reference-sheet"
        elif role_labeled_references:
            self.input_strategy = "role-labeled-multi-reference"
        elif max_input_references is not None and max_input_references < 4:
            self.input_strategy = "adaptive-reference"
        else:
            self.input_strategy = "multi-reference"

    @property
    def configured(self) -> bool:
        return bool(self.settings.openrouter_api_key and self._model_id)

    @property
    def endpoint(self) -> str:
        return f"{self.settings.openrouter_base_url.rstrip('/')}/images"

    @staticmethod
    def _reference(image: ImageInput) -> dict[str, Any]:
        encoded = base64.b64encode(image.content).decode("ascii")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{image.mime_type};base64,{encoded}"},
        }

    def _request_payload(
        self,
        avatar: ImageInput,
        garments: list[ImageInput],
        metadata: list[GarmentMetadata],
        avatar_profile: AvatarProfile | None = None,
    ) -> dict[str, Any]:
        use_reference_sheet = self._uses_reference_sheet(garments)
        if self.role_labeled_references:
            references = [
                ImageInput(
                    "person-base.png",
                    make_role_labeled_reference(
                        avatar.content,
                        role="PERSON BASE",
                        subtitle="SOLE IDENTITY AND BODY SOURCE",
                    ),
                ),
                *[
                    ImageInput(
                        f"garment-only-{index}.png",
                        make_role_labeled_reference(
                            garment.content,
                            role="GARMENT ONLY",
                            subtitle="COPY CLOTHING ONLY — IGNORE ANY WEARER",
                        ),
                    )
                    for index, garment in enumerate(garments, start=1)
                ],
            ]
            use_reference_sheet = False
        elif use_reference_sheet:
            sheet = make_reference_sheet(
                avatar.content, [item.content for item in garments]
            )
            references = [ImageInput("reference-sheet.png", sheet)]
        else:
            references = [avatar, *garments]

        payload: dict[str, Any] = {
            "model": self._model_id,
            "prompt": build_prompt(
                metadata,
                evaluation_round=self.evaluation_round,
                avatar_profile=avatar_profile,
                reference_sheet=use_reference_sheet,
            ),
            "input_references": [self._reference(image) for image in references],
        }
        if self.supports_n:
            payload["n"] = 1
        if self.supports_aspect_ratio:
            payload["aspect_ratio"] = "2:3"
        return payload

    def _uses_reference_sheet(self, garments: list[ImageInput]) -> bool:
        return self.reference_sheet or bool(
            self.max_input_references is not None
            and 1 + len(garments) > self.max_input_references
        )

    async def generate(
        self,
        avatar,
        garments,
        metadata,
        avatar_profile: AvatarProfile | None = None,
    ) -> ProviderResult:
        if not self.settings.openrouter_api_key:
            raise ProviderUnavailable(
                "OPENROUTER_API_KEY is not configured",
                category="NOT_CONFIGURED",
            )
        if not self._model_id:
            raise ProviderUnavailable(
                f"{self.display_name} has no official OpenRouter model slug",
                category="UNSUPPORTED_MODEL",
            )

        started = time.perf_counter()
        headers = {
            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "X-Title": self.settings.openrouter_app_title,
        }
        if self.settings.openrouter_http_referer:
            headers["HTTP-Referer"] = self.settings.openrouter_http_referer

        async with httpx.AsyncClient(
            timeout=self.settings.image_provider_timeout_seconds
        ) as client:
            response = await client.post(
                self.endpoint,
                headers=headers,
                json=self._request_payload(
                    avatar,
                    garments,
                    metadata,
                    avatar_profile,
                ),
            )
            response.raise_for_status()
            request_latency_ms = round((time.perf_counter() - started) * 1000)
            payload = response.json()
            generation_id = response.headers.get("X-Generation-Id") or payload.get("id")
            generation_metadata: dict[str, Any] = {}
            if generation_id:
                try:
                    metadata_response = await client.get(
                        f"{self.settings.openrouter_base_url.rstrip('/')}/generation",
                        headers=headers,
                        params={"id": generation_id},
                    )
                    if metadata_response.is_success:
                        metadata_payload = metadata_response.json()
                        if isinstance(metadata_payload.get("data"), dict):
                            generation_metadata = metadata_payload["data"]
                except (httpx.HTTPError, ValueError):
                    # The generation record may not be queryable immediately. Usage from
                    # the image response is still sufficient for cost accounting.
                    pass

        image, mime_type = _decode_first_image(payload)
        metrics = _openrouter_metrics(payload, generation_metadata, generation_id)
        input_strategy = (
            "role-labeled-multi-reference"
            if self.role_labeled_references
            else "reference-sheet"
            if self._uses_reference_sheet(garments)
            else "multi-reference"
        )
        return self._result(
            image,
            started,
            mime_type,
            latency_ms=request_latency_ms,
            input_strategy=input_strategy,
            **metrics,
        )


class FluxKleinProvider(BaseProvider):
    provider_id = "flux_klein_9b_lora"
    display_name = "FLUX.2 klein 9B + LoRA"
    input_strategy = "local-multi-reference"
    is_fallback = True

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.model = settings.flux_klein_model

    @property
    def configured(self) -> bool:
        return bool(self.settings.flux_klein_endpoint)

    async def generate(
        self,
        avatar,
        garments,
        metadata,
        avatar_profile: AvatarProfile | None = None,
    ) -> ProviderResult:
        if not self.configured:
            raise ProviderUnavailable("FLUX_KLEIN_ENDPOINT is not configured")
        started = time.perf_counter()
        headers = {}
        if self.settings.flux_klein_api_key:
            headers["Authorization"] = f"Bearer {self.settings.flux_klein_api_key}"
        files = [("images", (item.filename, item.content, item.mime_type)) for item in [avatar, *garments]]
        async with httpx.AsyncClient(timeout=self.settings.image_provider_timeout_seconds) as client:
            response = await client.post(
                f"{(self.settings.flux_klein_endpoint or '').rstrip('/')}/generate",
                headers=headers,
                data={
                    "model": self.model,
                    "prompt": build_canonical_prompt(metadata),
                    "lora_path": self.settings.flux_klein_lora_path or "",
                    "lora_scale": str(self.settings.flux_klein_lora_scale),
                    "width": "1024",
                    "height": "1536",
                },
                files=files,
            )
            response.raise_for_status()
        if response.headers.get("content-type", "").startswith("image/"):
            image, mime_type = response.content, response.headers["content-type"].split(";")[0]
        else:
            image, mime_type = _decode_first_image(response.json())
        return self._result(image, started, mime_type)


def commercial_providers(
    settings: Settings,
    evaluation_round: EvaluationRound = "ROUND_1",
) -> list[BaseProvider]:
    profile = evaluation_profile(evaluation_round)
    providers = [
        OpenRouterImageProvider(
            settings,
            provider_id="nano_banana_2",
            display_name="Nano Banana 2",
            model=settings.openrouter_nano_banana_model,
            evaluation_round=evaluation_round,
            role_labeled_references=profile.role_labeled_references,
        ),
        OpenRouterImageProvider(
            settings,
            provider_id="nano_banana_2_lite",
            display_name="Nano Banana 2 Lite",
            model=settings.openrouter_nano_banana_lite_model,
            evaluation_round=evaluation_round,
            role_labeled_references=profile.role_labeled_references,
        ),
        OpenRouterImageProvider(
            settings,
            provider_id="gpt_image_2",
            display_name="GPT Image 2",
            model=settings.openrouter_gpt_image_model,
            supports_aspect_ratio=False,
            evaluation_round=evaluation_round,
            role_labeled_references=profile.role_labeled_references,
        ),
        OpenRouterImageProvider(
            settings,
            provider_id="grok_imagine_quality",
            display_name="Grok Imagine Quality",
            model=settings.openrouter_grok_imagine_quality_model,
            max_input_references=3,
            evaluation_round=evaluation_round,
            role_labeled_references=profile.role_labeled_references,
        ),
        OpenRouterImageProvider(
            settings,
            provider_id="krea_2_medium",
            display_name="Krea 2 Medium",
            model=settings.openrouter_krea_medium_model,
            reference_sheet=True,
            supports_n=False,
            evaluation_round=evaluation_round,
            role_labeled_references=profile.role_labeled_references,
        ),
        OpenRouterImageProvider(
            settings,
            provider_id="flux_2_max",
            display_name="FLUX.2 Max",
            model=settings.openrouter_flux_max_model,
            supports_aspect_ratio=False,
            evaluation_round=evaluation_round,
            role_labeled_references=profile.role_labeled_references,
        ),
        OpenRouterImageProvider(
            settings,
            provider_id="mai_image_2_5_pro",
            display_name="MAI Image 2.5 Pro",
            model=settings.openrouter_mai_pro_model,
            reference_sheet=True,
            evaluation_round=evaluation_round,
            role_labeled_references=profile.role_labeled_references,
        ),
    ]
    by_id = {provider.provider_id: provider for provider in providers}
    return [by_id[provider_id] for provider_id in profile.provider_ids]
