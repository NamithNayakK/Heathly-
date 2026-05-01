import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import Base, engine
from app.services.emotion_classifier import get_emotion_pipeline
from app.services.mental_state_classifier import _load_artifact

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
async def load_ml_models() -> None:
    """Pre-load trained ML models at startup for faster inference."""
    try:
        get_emotion_pipeline()
        logger.info("✓ Emotion classification model loaded successfully")
    except Exception as e:
        logger.warning(f"⚠ Emotion model loading failed, will use fallback: {e}")

    try:
        _load_artifact()
        logger.info("✓ Mental state prediction model loaded successfully")
    except Exception as e:
        logger.warning(f"⚠ Mental state model loading failed, will use fallback: {e}")


app.include_router(api_router, prefix=settings.api_v1_prefix)
