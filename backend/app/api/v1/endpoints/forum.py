from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.forum_post import ForumPost
from app.models.user import User
from app.schemas.forum import ForumPostCreateRequest, ForumPostItem, ForumPostListResponse

router = APIRouter()


@router.get("/posts", response_model=ForumPostListResponse)
def list_posts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ForumPostListResponse:
    posts = db.query(ForumPost, User).join(User, ForumPost.user_id == User.id).order_by(ForumPost.created_at.desc()).all()
    return ForumPostListResponse(
        items=[
            ForumPostItem(
                id=post.id,
                title=post.title,
                content=post.content,
                author_name=user.full_name,
                created_at=post.created_at.isoformat(),
            )
            for post, user in posts
        ]
    )


@router.post("/posts", response_model=ForumPostItem, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: ForumPostCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ForumPostItem:
    post = ForumPost(user_id=current_user.id, title=payload.title, content=payload.content)
    db.add(post)
    db.commit()
    db.refresh(post)

    return ForumPostItem(
        id=post.id,
        title=post.title,
        content=post.content,
        author_name=current_user.full_name,
        created_at=post.created_at.isoformat(),
    )


@router.post("/posts/{post_id}/flag")
async def flag_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from app.services.webhook_service import send_webhook_to_n8n_forum_moderation
    post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_flagged = True
    db.commit()

    # Trigger n8n Workflow 3: Forum Moderation Alert
    await send_webhook_to_n8n_forum_moderation(
        post_id=post.id,
        title=post.title,
        content=post.content,
        reason="Flagged for Moderation Review"
    )

    return {"status": "success", "id": post_id, "is_flagged": True}

