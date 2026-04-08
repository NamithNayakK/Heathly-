from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatHistoryItem, ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.chatbot import generate_cbt_response

router = APIRouter()


@router.post("/message", response_model=ChatResponse)
def chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    result = generate_cbt_response(payload.message)
    response = ChatResponse(**result)

    message = ChatMessage(
        user_id=current_user.id,
        user_message=payload.message,
        bot_response=response.response,
        emotion=response.emotion,
        confidence=response.confidence,
        escalation_required=response.escalation_required,
    )
    db.add(message)
    db.commit()

    return response


@router.get("/history", response_model=ChatHistoryResponse)
def chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatHistoryResponse:
    records = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .all()
    )

    return ChatHistoryResponse(
        items=[
            ChatHistoryItem(
                id=record.id,
                user_message=record.user_message,
                bot_response=record.bot_response,
                emotion=record.emotion,
                confidence=record.confidence,
                escalation_required=record.escalation_required,
                created_at=record.created_at.isoformat(),
            )
            for record in records
        ]
    )
