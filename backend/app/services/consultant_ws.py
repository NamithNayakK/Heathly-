import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConsultantSessionManager:
    """Manages WebSocket connections for consultants/doctors watching live patient video sessions."""

    def __init__(self):
        # Map session_id (str) -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        key = str(session_id)
        if key not in self.active_connections:
            self.active_connections[key] = set()
        self.active_connections[key].add(websocket)
        logger.info(f"Consultant WebSocket connected for session '{key}'. Total clients for session: {len(self.active_connections[key])}")

    def disconnect(self, session_id: str, websocket: WebSocket):
        key = str(session_id)
        if key in self.active_connections:
            self.active_connections[key].discard(websocket)
            if not self.active_connections[key]:
                del self.active_connections[key]
        logger.info(f"Consultant WebSocket disconnected for session '{key}'")

    async def broadcast(self, session_id: str, data: Dict[str, Any]):
        key = str(session_id)
        if key in self.active_connections:
            disconnected = set()
            for ws in list(self.active_connections[key]):
                try:
                    await ws.send_json(data)
                except Exception as e:
                    logger.warning(f"Error broadcasting live frame to consultant WS for session '{key}': {e}")
                    disconnected.add(ws)
            for ws in disconnected:
                self.active_connections[key].discard(ws)

consultant_session_manager = ConsultantSessionManager()
