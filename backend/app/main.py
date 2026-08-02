# Healthly main application module
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


async def daily_cleanup_and_aggregation_loop():
    """Background scheduler task to aggregate daily metrics and purge stale sensor data."""
    logger.info("✓ Background WiFi aggregation & retention scheduler started")
    while True:
        try:
            # Check for aggregates and cleanup every 6 hours
            await asyncio.sleep(21600)
            from app.db.session import SessionLocal
            from app.api.v1.endpoints.wifi_sensor import run_daily_aggregations
            from app.models.wifi_sensor import SensorReading
            from datetime import datetime, timedelta
            
            db = SessionLocal()
            try:
                # 1. Run daily aggregations
                await run_daily_aggregations(db)
                
                # 2. Enforce 90-day retention policy
                cutoff = datetime.utcnow() - timedelta(days=90)
                deleted = db.query(SensorReading).filter(SensorReading.timestamp < cutoff).delete()
                db.commit()
                if deleted:
                    logger.info(f"Purged {deleted} telemetry records older than 90 days (retention policy).")
            except Exception as e:
                logger.error(f"Error in background daily scheduler execution: {e}")
                db.rollback()
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Background daily scheduler cancelled.")
            break
        except Exception as e:
            logger.error(f"Background daily scheduler error: {e}")


async def google_fit_background_sync_loop():
    """Background scheduler task to periodically sync Google Fit telemetry for connected users every 30 minutes."""
    logger.info("✓ Background Google Fit telemetry scheduler started (interval: 30 mins)")
    while True:
        try:
            await asyncio.sleep(1800) # 30 minutes
            from app.db.session import SessionLocal
            from app.services.google_fit_service import run_scheduled_google_fit_sync
            
            db = SessionLocal()
            try:
                await run_scheduled_google_fit_sync(db)
            except Exception as e:
                logger.error(f"Error in background Google Fit sync job: {e}")
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Background Google Fit scheduler cancelled.")
            break
        except Exception as e:
            logger.error(f"Background Google Fit scheduler loop error: {e}")


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
        
    # Start the async background aggregation loop
    asyncio.create_task(daily_cleanup_and_aggregation_loop())
    
    # Start the websocket heartbeat monitoring loop
    from app.api.v1.endpoints.wifi_sensor import websocket_heartbeat_monitor
    asyncio.create_task(websocket_heartbeat_monitor())

    # Start background Google Fit sync loop
    asyncio.create_task(google_fit_background_sync_loop())




from app.api.v1.endpoints.wifi_sensor import router as wifi_router
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from jose import jwt, JWTError
from app.models.user import User
from app.services.consultant_ws import consultant_session_manager

from app.api.v1.endpoints.google_fit import router as google_fit_router

app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(wifi_router)
app.include_router(google_fit_router, prefix="/api/auth/google-fit", tags=["google-fit-root"])


def get_websocket_user_from_token(token: str | None, db):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        subject = payload.get("sub")
        if subject:
            return db.query(User).filter(User.email == subject).first()
    except JWTError:
        pass
    return None

@app.websocket("/ws/consultant/session/{session_id}")
async def websocket_consultant_session(websocket: WebSocket, session_id: str):
    """Real-time live emotion telemetry WebSocket feed for consultants and doctors."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        token = websocket.query_params.get("token")
        if not token:
            auth_header = websocket.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
        
        user = get_websocket_user_from_token(token, db)
        if not user or (user.role or "patient") not in ["consultant", "admin"]:
            logger.warning(f"Rejecting WS connection for session {session_id}: user={user.email if user else 'anonymous'}, role={user.role if user else 'none'}")
            await websocket.close(code=4003, reason="Forbidden: Only consultants and admins can access live session feeds.")
            return

        await consultant_session_manager.connect(session_id, websocket)
        
        await websocket.send_json({
            "event": "connected",
            "session_id": session_id,
            "status": "connected",
            "message": f"Subscribed to live session feed for session '{session_id}'"
        })
        
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        consultant_session_manager.disconnect(session_id, websocket)
    except Exception as e:
        logger.error(f"Error in consultant WS handler for session {session_id}: {e}")
        consultant_session_manager.disconnect(session_id, websocket)
    finally:
        db.close()



