from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    response: str
    emotion: str
    confidence: float
    escalation_required: bool
    risk_probability: float | None = None


class ChatHistoryItem(BaseModel):
    id: int
    user_message: str
    bot_response: str
    emotion: str
    confidence: float
    escalation_required: bool
    created_at: str


class ChatHistoryResponse(BaseModel):
    items: list[ChatHistoryItem]
