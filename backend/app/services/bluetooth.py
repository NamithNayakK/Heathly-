import asyncio
import logging
import random
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)

MOCK_DEVICES = [
    {
        "name": "Healthly Smart Band Pro",
        "address": "AA:BB:CC:DD:EE:01",
        "device_type": "Smartband",
        "brand": "Healthly",
        "rssi": -58,
        "is_mock": True
    },
    {
        "name": "Oura Ring Gen3 (Simulated)",
        "address": "AA:BB:CC:DD:EE:02",
        "device_type": "Smart Ring",
        "brand": "Oura",
        "rssi": -65,
        "is_mock": True
    },
    {
        "name": "Apple Watch Series 9 (Simulated)",
        "address": "AA:BB:CC:DD:EE:03",
        "device_type": "Smartwatch",
        "brand": "Apple",
        "rssi": -72,
        "is_mock": True
    }
]

class BluetoothService:
    """BLE / Simulated telemetry service for real-time sensor streaming."""

    def __init__(self):
        self.connected_device: Optional[Dict[str, Any]] = None
        self.connected_user_id: Optional[int] = None
        self.is_connected: bool = False
        self.battery_level: int = 92

    async def scan_devices(self) -> List[Dict[str, Any]]:
        """Return available mock BLE devices."""
        await asyncio.sleep(0.5)
        return MOCK_DEVICES

    async def connect_device(self, address: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Connect to real or simulated BLE wearable."""
        device = next((d for d in MOCK_DEVICES if d["address"] == address), None)
        if not device:
            device = {
                "name": f"BLE Device ({address})",
                "address": address,
                "device_type": "Wearable Sensor",
                "brand": "Generic",
                "rssi": -60,
                "is_mock": True
            }
        
        self.connected_device = device
        self.connected_user_id = user_id
        self.is_connected = True
        self.battery_level = random.randint(75, 100)
        logger.info(f"Connected to BLE device: {device['name']}")
        return {
            "status": "success",
            "message": f"Successfully connected to {device['name']}",
            "device": device
        }

    async def disconnect_device(self) -> Dict[str, Any]:
        """Disconnect active BLE device."""
        prev_name = self.connected_device.get("name") if self.connected_device else "Device"
        self.connected_device = None
        self.connected_user_id = None
        self.is_connected = False
        logger.info(f"Disconnected BLE device: {prev_name}")
        return {
            "status": "success",
            "message": f"Disconnected from {prev_name}"
        }

    def get_status(self) -> Dict[str, Any]:
        """Return current status dictionary."""
        return {
            "connected": self.is_connected,
            "device": self.connected_device,
            "is_mocked": True,
            "battery_level": self.battery_level if self.is_connected else None,
            "real_ble_supported": False
        }

    async def stream_telemetry_websocket(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate 1Hz telemetry updates with heart rate, HRV, blood oxygen, and stress predictions."""
        while self.is_connected:
            hr = round(random.uniform(62.0, 98.0), 1)
            hrv = round(random.uniform(35.0, 75.0), 1)
            spo2 = round(random.uniform(96.0, 99.5), 1)
            temp = round(random.uniform(36.2, 37.1), 1)
            stress_prob = round(random.uniform(0.12, 0.45), 2)
            
            packet = {
                "timestamp": int(time.time()),
                "heart_rate": hr,
                "hrv": hrv,
                "spo2": spo2,
                "temperature": temp,
                "stress_level": "low" if stress_prob < 0.35 else "moderate",
                "stress_probability": stress_prob,
                "battery_level": self.battery_level,
                "device_name": self.connected_device["name"] if self.connected_device else "Sensor"
            }
            yield packet
            await asyncio.sleep(1.0)

bluetooth_service = BluetoothService()
