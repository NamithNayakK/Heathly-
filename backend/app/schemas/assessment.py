from pydantic import BaseModel, Field, field_validator


class PHQ9Request(BaseModel):
    answers: list[int] = Field(min_length=9, max_length=9)

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, values: list[int]) -> list[int]:
        if any(value < 0 or value > 3 for value in values):
            raise ValueError("PHQ-9 answers must be between 0 and 3")
        return values


class PHQ9Response(BaseModel):
    score: int
    risk_level: str
    high_risk: bool
    recommended_action: str
    risk_probability: float | None = None
    emotional_score: int | None = None
    cognitive_score: int | None = None
    physical_score: int | None = None
    functional_score: int | None = None


class PHQ9HistoryItem(BaseModel):
    id: int
    score: int
    risk_level: str
    high_risk: bool
    recommended_action: str
    created_at: str


class PHQ9HistoryResponse(BaseModel):
    items: list[PHQ9HistoryItem]
