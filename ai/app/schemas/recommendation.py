from pydantic import BaseModel, ConfigDict, Field


class RankCondition(BaseModel):
    """추천 조건. Spring 이 이미 필터링한 조건을 스코어링 기준으로 다시 전달받는다."""

    model_config = ConfigDict(populate_by_name=True)

    category: str
    subcategory: str | None = None
    budget_min: int = Field(alias="budgetMin", ge=0)
    budget_max: int = Field(alias="budgetMax", ge=0)
    moods: list[str] = Field(default_factory=list)


class RankCandidate(BaseModel):
    """순위 계산 대상 상품. 판매 상태·카테고리·예산 필터는 Spring 에서 끝난 상태다."""

    model_config = ConfigDict(populate_by_name=True)

    product_id: int = Field(alias="productId")
    name: str
    brand: str
    price: int
    category: str
    subcategory: str | None = None
    color_group: str | None = Field(default=None, alias="colorGroup")
    description: str | None = None


class RankRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    recommendation_id: int | None = Field(default=None, alias="recommendationId")
    condition: RankCondition
    limit: int = Field(default=12, ge=1, le=100)
    candidates: list[RankCandidate] = Field(default_factory=list)


class RankedProduct(BaseModel):
    """응답은 FastAPI 기본 설정(by_alias)에 따라 camelCase 로 직렬화된다."""

    model_config = ConfigDict(populate_by_name=True)

    product_id: int = Field(alias="productId")
    rank: int
    score: float


class RankResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: str = Field(alias="schemaVersion")
    ranked: list[RankedProduct]
