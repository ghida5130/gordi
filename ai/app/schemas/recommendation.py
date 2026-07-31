from pydantic import BaseModel, ConfigDict, Field, model_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class CamelCaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class RankCondition(CamelCaseModel):
    gender: str = Field(pattern="^(MALE|FEMALE)$")
    category: str = Field(min_length=1)
    subcategory: str | None = None
    budget_min: int = Field(ge=0)
    budget_max: int = Field(ge=0)
    moods: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_budget_range(self) -> "RankCondition":
        if self.budget_min > self.budget_max:
            raise ValueError("budgetMin must be less than or equal to budgetMax")
        return self


class RankCandidate(CamelCaseModel):
    product_id: int = Field(gt=0)
    name: str = Field(min_length=1)
    brand: str = Field(min_length=1)
    price: int = Field(ge=0)
    gender: str = Field(pattern="^(MALE|FEMALE|UNISEX)$")
    category: str = Field(min_length=1)
    subcategory: str = Field(min_length=1)
    description: str | None = None


class RankRequest(CamelCaseModel):
    recommendation_id: int = Field(gt=0)
    condition: RankCondition
    limit: int = Field(ge=1, le=100)
    candidates: list[RankCandidate] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def validate_unique_product_ids(self) -> "RankRequest":
        product_ids = [candidate.product_id for candidate in self.candidates]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("candidate productId values must be unique")
        return self


class RankedProduct(CamelCaseModel):
    product_id: int = Field(gt=0)
    rank: int = Field(gt=0)
    score: float = Field(ge=0.0, le=1.0)


class RankResponse(CamelCaseModel):
    schema_version: str
    ranked: list[RankedProduct]


class SearchRecommendationRequest(CamelCaseModel):
    recommendation_id: int = Field(gt=0)
    text: str | None = Field(default=None, max_length=2_000)
    image_url: str | None = Field(default=None, max_length=2_048)
    gender: str = Field(pattern="^(MALE|FEMALE)$")
    category: str | None = Field(default=None, min_length=1, max_length=100)
    subcategory: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    budget_min: int = Field(default=0, ge=0)
    budget_max: int | None = Field(default=None, ge=0)
    candidate_limit: int = Field(default=50, ge=1, le=200)
    result_limit: int = Field(default=10, ge=1, le=50)

    @model_validator(mode="after")
    def validate_search_request(self) -> "SearchRecommendationRequest":
        if not (self.text or "").strip() and not (
            self.image_url or ""
        ).strip():
            raise ValueError("text or imageUrl is required")
        if (
            self.budget_max is not None
            and self.budget_min > self.budget_max
        ):
            raise ValueError(
                "budgetMin must be less than or equal to budgetMax"
            )
        if self.result_limit > self.candidate_limit:
            raise ValueError(
                "resultLimit must be less than or equal to candidateLimit"
            )
        return self


class RecommendedProduct(CamelCaseModel):
    product_id: int = Field(gt=0)
    rank: int = Field(gt=0)
    score: float = Field(ge=0.0, le=1.0)
    retrieval_score: float = Field(ge=0.0, le=1.0)
    compatibility_score: float = Field(ge=0.0, le=1.0)
    reason: str = Field(min_length=1)


class SearchRecommendationResponse(CamelCaseModel):
    schema_version: str
    recommendation_id: int = Field(gt=0)
    index_version: str = Field(min_length=64, max_length=64)
    results: list[RecommendedProduct]
