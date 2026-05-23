import asyncio
import logging
import random
from datetime import datetime
from typing import Dict, Any, List, Optional, AsyncGenerator

from app.services.wearable_lstm import wearable_lstm_analyzer
from app.db.session import SessionLocal
from app.models.sensor_data import SensorData

logger = logging.getLogger(__name__)

# Attempt to load bleak safely
try:
    import bleak
    from bleak import BleakScanner, BleakClient
    from bleak.exc import BleakError
    BLE_SUPPORTED = True
except ImportError:
    bleak = None
    BleakScanner = None
    BleakClient = None
    BleakError = Exception
    BLE_SUPPORTED = False

# BLE standard service and characteristic UUIDs
HEART_RATE_SERVICE_UUID = "180d"
HEART_RATE_MEASUREMENT_UUID = "2a37"
BATTERY_SERVICE_UUID = "180f"
BATTERY_LEVEL_UUID = "2a19"

MOCK_DEVICES = [
    {
        "name": "boAt Wave Connect (Simulated)",
        "address": "FC:F5:C4:0A:1E:59",
        "device_type": "Smartwatch",
        "brand": "boAt",
        "rssi": -65,
        "is_mock": True
    },
    {
        "name": "HONOR Band 6 (Simulated)",
        "address": "D8:8B:4C:E6:AA:21",
        "device_type": "Smart Band",
        "brand": "HONOR",
        "rssi": -72,
        "is_mock": True
    },
    {
        "name": "Polar H10 (Simulated)",
        "address": "00:22:D0:A8:14:F2",
        "device_type": "Fitness Tracker",
        "brand": "Polar",
        "rssi": -58,
        "is_mock": True
    },
    {
        "name": "Fitbit Charge 5 (Simulated)",
        "address": "74:E8:2C:99:A5:10",
        "device_type": "Fitness Tracker",
        "brand": "Fitbit",
        "rssi": -80,
        "is_mock": True
    }
]

class BluetoothService:
    """Modular service managing direct BLE wearable integrations and telemetry streaming."""

    def __init__(self):
        self.connected_device: Optional[Dict[str, Any]] = None
        self.client: Optional[BleakClient] = None
        self._is_connecting: bool = False
        
        # Telemetry Cache
        self.heart_rate: float = 75.0
        self.hrv: float = 55.0
        self.gsr: float = 3.2
        self.spo2: float = 98.0
        self.steps: float = 4250.0
        self.sleep_hours: float = 7.2
        self.battery_level: int = 88
        self.is_mocked: bool = True
        
        # Stream task management
        self.telemetry_loop_task: Optional[asyncio.Task] = None
        self.db_save_counter: int = 0
        self.current_user_id: Optional[int] = None
        
        # Waveform buffer (for simulated clinical ECG/PPG drawing on UI)
        self.wave_phase = 0.0

    def parse_heart_rate(self, data: bytearray) -> int:
        """Parses standard BLE heart rate measurement characteristic notification.
        Standard specification (2a37):
        - First byte: flags. Bit 0 indicates size (0 = uint8, 1 = uint16).
        """
        if not data or len(data) < 2:
            return 75
        flags = data[0]
        is_u16 = flags & 0x01
        if is_u16:
            if len(data) >= 3:
                return (data[2] << 8) | data[1]
            return data[1]
        else:
            return data[1]

    async def scan_devices(self) -> List[Dict[str, Any]]:
        """Scans for nearby BLE devices and returns both real and high-fidelity mock ones."""
        devices = []
        if BLE_SUPPORTED:
            try:
                logger.info("Starting BLE scan...")
                scanner = BleakScanner()
                scanned = await scanner.discover(timeout=3.0)
                for d in scanned:
                    # Filter for wearables by looking at name clues
                    name = d.name or "Unknown Device"
                    is_wearable = any(
                        keyword in name.lower()
                        for keyword in ["watch", "band", "heart", "polar", "fitbit", "garmin", "smart", "hrm", "ble"]
                    )
                    devices.append({
                        "name": name,
                        "address": d.address,
                        "device_type": "Smartwatch/Fitness Band" if is_wearable else "BLE Device",
                        "brand": "Generic BLE" if "polar" not in name.lower() else "Polar",
                        "rssi": d.rssi,
                        "is_mock": False
                    })
            except Exception as e:
                logger.warning(f"BLE scanner issue: {e}. Returning simulated wearables.")

        # Always append our pre-configured premium wearable mock options to allow quick clinical validation
        devices.extend(MOCK_DEVICES)
        return devices

    async def connect_device(self, address: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Connects to a specific wearable device (real BLE or high-fidelity simulation)."""
        if self._is_connecting:
            return {"status": "error", "message": "Connection attempt already in progress."}
            
        self._is_connecting = True
        self.current_user_id = user_id
        
        # First clean up any existing connection
        await self.disconnect_device()

        # Check if the address belongs to a mock device
        mock_dev = next((d for d in MOCK_DEVICES if d["address"] == address), None)
        if mock_dev:
            self.connected_device = {**mock_dev, "connected_at": datetime.utcnow().isoformat()}
            self.is_mocked = True
            self.battery_level = random.randint(75, 95)
            self._start_telemetry_loop()
            self._is_connecting = False
            logger.info(f"Connected to simulated wearable: {mock_dev['name']}")
            return {
                "status": "connected",
                "device": self.connected_device,
                "is_mocked": True
            }

        # Otherwise, attempt to connect to a real BLE device
        if not BLE_SUPPORTED:
            self._is_connecting = False
            return {
                "status": "error",
                "message": "Bluetooth adapter missing or bleak library not fully supported in this context. Use simulated device instead."
            }

        try:
            logger.info(f"Attempting BLE connection to real device: {address}...")
            client = BleakClient(address)
            # Use a timeout of 5 seconds
            await asyncio.wait_for(client.connect(), timeout=5.0)
            
            self.client = client
            self.is_mocked = False
            
            # Retrieve name and basic info
            try:
                # Discover services
                services = client.services
                logger.info(f"Services discovered for {address}")
            except Exception as e:
                logger.warning(f"Failed to discover services for {address}: {e}")

            # Try to read battery level
            try:
                battery_char = client.services.get_characteristic(BATTERY_LEVEL_UUID)
                if battery_char:
                    bat_bytes = await client.read_gatt_char(battery_char)
                    self.battery_level = int(bat_bytes[0])
            except Exception:
                self.battery_level = 88 # Default placeholder for real device

            # Try to subscribe to Heart Rate notification
            try:
                hr_char = client.services.get_characteristic(HEART_RATE_MEASUREMENT_UUID)
                if hr_char:
                    await client.start_notify(hr_char, self._real_hr_callback)
                    logger.info("Successfully subscribed to real-time BLE Heart Rate notifications.")
            except Exception as e:
                logger.warning(f"Could not subscribe to standard BLE heart rate: {e}. Will simulate telemetry on top of real connection.")

            self.connected_device = {
                "name": "BLE Smart Device",
                "address": address,
                "device_type": "BLE Wearable",
                "brand": "Direct BLE Integration",
                "rssi": -60,
                "is_mock": False,
                "connected_at": datetime.utcnow().isoformat()
            }
            
            self._start_telemetry_loop()
            self._is_connecting = False
            return {
                "status": "connected",
                "device": self.connected_device,
                "is_mocked": False
            }

        except Exception as e:
            logger.error(f"Failed to connect to BLE device {address}: {e}")
            self._is_connecting = False
            return {
                "status": "error",
                "message": f"BLE connection failed: {str(e)}. Ensure Bluetooth is ON and the device is nearby."
            }

    def _real_hr_callback(self, sender, data: bytearray):
        """Callback for GATTS notification from real BLE wearable."""
        parsed_hr = self.parse_heart_rate(data)
        self.heart_rate = float(parsed_hr)
        # HRV naturally responds to physical heart rate
        # HRV = variation in milliseconds (more stress -> less variation -> lower HRV)
        base_hrv = 68.0 - (self.heart_rate - 70.0) * 0.5
        self.hrv = max(15.0, min(110.0, base_hrv + random.uniform(-4, 4)))
        logger.info(f"Real BLE Heart Rate Update: {self.heart_rate} BPM | HRV: {self.hrv:.1f} ms")

    def _start_telemetry_loop(self):
        """Starts the background loop that manages stateful telemetry fluctuations and db caching."""
        self._stop_telemetry_loop()
        self.telemetry_loop_task = asyncio.create_task(self._telemetry_generation_loop())

    def _stop_telemetry_loop(self):
        if self.telemetry_loop_task:
            self.telemetry_loop_task.cancel()
            self.telemetry_loop_task = None

    async def _telemetry_generation_loop(self):
        """Performs continuous updates to cached telemetry data at 1Hz."""
        self.db_save_counter = 0
        while True:
            try:
                # 1. Fluctuate biometric telemetry values dynamically
                if self.is_mocked:
                    # Natural physiological oscillation (sinusoidal + noise)
                    now_sec = datetime.utcnow().timestamp()
                    
                    # Heart rate naturally rises and falls based on simulated stress spikes
                    stress_spike = 15.0 if int(now_sec / 30) % 2 == 1 else 0.0
                    self.heart_rate = round(72.0 + stress_spike + math_sin_wave(now_sec * 0.05) * 5.0 + random.uniform(-2.0, 2.0), 1)
                    
                    # HRV varies inversely with HR (sympathetic load lowers HRV)
                    target_hrv = 65.0 - (self.heart_rate - 70.0) * 0.6
                    self.hrv = round(max(20.0, min(100.0, target_hrv + random.uniform(-3.0, 3.0))), 1)
                    
                    # Galvanic Skin Response (GSR) in uS
                    target_gsr = 2.0 + (stress_spike * 0.15)
                    self.gsr = round(max(0.5, min(8.0, target_gsr + random.uniform(-0.1, 0.1))), 2)
                    
                    # SpO2 fluctuates between 97% and 99%
                    self.spo2 = round(max(95.0, min(100.0, 98.0 + random.uniform(-0.5, 0.5))), 1)
                    
                    # Increment step count gradually
                    self.steps += random.choice([0.0, 0.0, 1.0, 2.0, 3.0])
                    
                    # Slow battery depletion
                    if random.random() < 0.005:
                        self.battery_level = max(1, self.battery_level - 1)
                else:
                    # If we are connected to a real device, our HR and HRV are updated by the BLE callback!
                    # We only simulate GSR and steps around standard baselines
                    self.gsr = round(max(0.5, min(8.0, 3.0 + random.uniform(-0.15, 0.15))), 2)
                    self.spo2 = round(max(96.0, min(100.0, 98.5 + random.uniform(-0.2, 0.2))), 1)
                    self.steps += random.choice([0.0, 1.0, 2.0])

                # 2. Database Snapshot caching: Every 10 seconds, write to SQLite
                self.db_save_counter += 1
                if self.db_save_counter >= 10:
                    self.db_save_counter = 0
                    if self.current_user_id:
                        self._persist_sensor_snapshot()

                await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in telemetry loop: {e}")
                await asyncio.sleep(1.0)

    def _persist_sensor_snapshot(self):
        """Creates a record in the sqlite SensorData table for historical assessment analysis."""
        db = SessionLocal()
        try:
            # First, run wearable lstm analysis to calculate current stress index
            assessment = wearable_lstm_analyzer.analyze(
                self.heart_rate, self.hrv, self.sleep_hours, self.steps
            )
            
            sensor_data = SensorData(
                user_id=self.current_user_id,
                heart_rate_variability=self.hrv,
                galvanic_skin_response=self.gsr,
                sleep_duration_hours=self.sleep_hours,
                stress_index=assessment.stress_index
            )
            db.add(sensor_data)
            db.commit()
            logger.info(f"✓ Cached sensor snapshot to SQLite. Stress index: {assessment.stress_index}")
        except Exception as e:
            logger.error(f"Failed to cache sensor snapshot to SQLite: {e}")
            db.rollback()
        finally:
            db.close()

    async def disconnect_device(self) -> Dict[str, Any]:
        """Gracefully disconnects any active BLE client and halts the background telemetry task."""
        self._stop_telemetry_loop()
        
        device_name = self.connected_device["name"] if self.connected_device else "None"
        self.connected_device = None
        
        if self.client:
            try:
                # Stop GATTS notification if active
                try:
                    await self.client.stop_notify(HEART_RATE_MEASUREMENT_UUID)
                except Exception:
                    pass
                await self.client.disconnect()
                logger.info("Real BLE client disconnected successfully.")
            except Exception as e:
                logger.warning(f"Error during BLE disconnect: {e}")
            finally:
                self.client = None

        logger.info("Wearable device fully disconnected.")
        return {"status": "disconnected", "previous_device": device_name}

    def get_status(self) -> Dict[str, Any]:
        """Returns connection state and live device statistics."""
        if not self.connected_device:
            return {
                "connected": False,
                "device": None,
                "is_mocked": self.is_mocked
            }
        return {
            "connected": True,
            "device": self.connected_device,
            "is_mocked": self.is_mocked,
            "battery_level": self.battery_level,
            "real_ble_supported": BLE_SUPPORTED
        }

    async def stream_telemetry_websocket(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Yields physiological telemetry parsed through the BiLSTM model in real time (1Hz)."""
        while self.connected_device is not None:
            now_sec = datetime.utcnow().timestamp()
            
            # Execute BiLSTM Stress Inference
            analysis = wearable_lstm_analyzer.analyze(
                self.heart_rate, self.hrv, self.sleep_hours, self.steps
            )
            
            # Synthesize real-time ECG/PPG clinical waveform values for high fidelity frontend plots
            self.wave_phase = (self.wave_phase + 0.15) % (2 * 3.14159)
            # Create a heartbeat pulse shape
            pulse = math_sin_wave(self.wave_phase * 5.0)
            if pulse > 0.8:
                pulse = 1.0 + random.uniform(-0.1, 0.1) # QRS peak
            elif pulse < -0.6:
                pulse = -0.4
            else:
                pulse = pulse * 0.2 + random.uniform(-0.02, 0.02)
                
            ppg_waveform = round(pulse, 4)

            # Map attention fusion contribution
            # In the multimodal dashboard, the sensor mode is allocated a weight (e.g. ~30%)
            # We communicate the contribution weight and positive/negative status directly in the packet
            sensor_weight = 0.30
            contribution_direction = "negative_influence" if analysis.stress_index >= 0.50 else "positive_influence"

            telemetry_packet = {
                "timestamp": datetime.utcnow().isoformat(),
                "device_status": {
                    "connected": True,
                    "device_name": self.connected_device["name"],
                    "address": self.connected_device["address"],
                    "battery_level": self.battery_level,
                    "is_mocked": self.is_mocked,
                },
                "telemetry": {
                    "heart_rate": self.heart_rate,
                    "heart_rate_variability": self.hrv,
                    "galvanic_skin_response": self.gsr,
                    "spo2": self.spo2,
                    "steps": int(self.steps),
                    "activity_level": "Strenuous" if self.heart_rate > 95 else "Moderate" if self.heart_rate > 78 else "Resting",
                    "ppg_waveform": ppg_waveform
                },
                "ai_analysis": {
                    "stress_index": analysis.stress_index,
                    "risk_classification": analysis.physiological_risk,
                    "stress_pattern": analysis.stress_pattern,
                    "anomaly_flags": analysis.anomaly_flags,
                    "confidence_score": round(0.92 if not self.is_mocked else 0.85, 2)
                },
                "fusion_contribution": {
                    "sensor_weight": sensor_weight,
                    "sensor_contribution": contribution_direction
                }
            }

            yield telemetry_packet
            await asyncio.sleep(1.0)

def math_sin_wave(val: float) -> float:
    """Helper to avoid importing math inside active hot-loops if we can just approximate it or use math."""
    import math
    return math.sin(val)

# Singleton Instance
bluetooth_service = BluetoothService()
