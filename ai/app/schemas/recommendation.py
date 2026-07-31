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
