from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import Base, engine


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


app.include_router(api_router, prefix=settings.api_v1_prefix)
