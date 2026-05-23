import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.models.user import User
from app.services.bluetooth import bluetooth_service, MOCK_DEVICES

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectRequest(BaseModel):
    address: str

class DeviceResponse(BaseModel):
    name: str
    address: str
    device_type: str
    brand: str
    rssi: int
    is_mock: bool

class ConnectionStatusResponse(BaseModel):
    connected: bool
    device: Optional[dict] = None
    is_mocked: bool
    battery_level: Optional[int] = None
    real_ble_supported: bool

@router.get("/devices", response_model=List[DeviceResponse])
async def list_ble_devices(current_user: User = Depends(get_current_user)) -> List[dict]:
    """Scan for nearby Bluetooth Low Energy devices and return scanned + high-fidelity mock ones."""
    try:
        devices = await bluetooth_service.scan_devices()
        return devices
    except Exception as e:
        logger.error(f"Failed to scan BLE devices: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scanning failed: {str(e)}"
        )

@router.post("/connect")
async def connect_ble_device(
    payload: ConnectRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Connect to a selected BLE wearable by MAC address (real or simulated)."""
    try:
        result = await bluetooth_service.connect_device(payload.address, user_id=current_user.id)
        if result.get("status") == "error":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("message", "Failed to connect to device.")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Connection endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Connection failed: {str(e)}"
        )

@router.post("/disconnect")
async def disconnect_ble_device(current_user: User = Depends(get_current_user)) -> dict:
    """Disconnect currently active BLE/simulated wearable connection."""
    try:
        result = await bluetooth_service.disconnect_device()
        return result
    except Exception as e:
        logger.error(f"Disconnect endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Disconnection failed: {str(e)}"
        )

@router.get("/status", response_model=ConnectionStatusResponse)
def get_device_status(current_user: User = Depends(get_current_user)) -> dict:
    """Check current wearable connection status, battery, and signal strength."""
    try:
        return bluetooth_service.get_status()
    except Exception as e:
        logger.error(f"Status endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch status: {str(e)}"
        )

@router.websocket("/stream")
async def websocket_telemetry_stream(websocket: WebSocket, token: Optional[str] = None):
    """Real-time 1Hz WebSocket stream pushing parsed biometrics and BiLSTM stress inference to client."""
    await websocket.accept()
    logger.info("WebSocket telemetry stream client connected.")
    
    # Auto-connect to first mock device if not already connected
    status_now = bluetooth_service.get_status()
    if not status_now["connected"]:
        # We auto-associate with user_id = 1 or search if we can do something else, but let's connect
        await bluetooth_service.connect_device(MOCK_DEVICES[0]["address"])
        logger.info(f"Auto-connected to {MOCK_DEVICES[0]['name']} for WS telemetry stream.")

    try:
        async for packet in bluetooth_service.stream_telemetry_websocket():
            await websocket.send_json(packet)
    except WebSocketDisconnect:
        logger.info("WebSocket telemetry stream client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket stream loop encountered error: {e}")
    finally:
        # Don't auto-disconnect from BLE device to allow continuous reading and reconnection persistence
        pass
