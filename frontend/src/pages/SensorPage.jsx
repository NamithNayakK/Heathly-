import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Heart, Battery, Radio, Shield, RefreshCw, Zap,
  AlertTriangle, AlertCircle, CheckCircle2, Wifi, Layers,
  Cpu, Footprints, Flame, TrendingUp, Power, Compass
} from "lucide-react";
import { api } from "../lib/api";

export default function SensorPage() {
  // BLE Connection & Scanner state
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isMocked, setIsMocked] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [connectingAddress, setConnectingAddress] = useState(null);
  
  // Real-time Telemetry state
  const [telemetry, setTelemetry] = useState({
    heart_rate: 75,
    heart_rate_variability: 55,
    galvanic_skin_response: 3.2,
    spo2: 98,
    steps: 4250,
    activity_level: "Resting",
    ppg_waveform: 0.0
  });

  // AI Inference & Fusion state
  const [aiAnalysis, setAiAnalysis] = useState({
    stress_index: 0.34,
    risk_classification: "Low",
    stress_pattern: "Stable homeostatic balance and optimal vagal recovery.",
    anomaly_flags: [],
    confidence_score: 0.88
  });

  const [fusion, setFusion] = useState({
    sensor_weight: 0.30,
    sensor_contribution: "positive_influence"
  });

  // UI States
  const [systemLogs, setSystemLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected"); // disconnected, connecting, connected
  
  // Ref to hold running buffer of PPG wave points for scrolling visualization
  const [wavePoints, setWavePoints] = useState(Array(60).fill(0));
  const websocketRef = useRef(null);
  const ppgBufferRef = useRef(Array(60).fill(0));

  // Add a line to the dashboard terminal log
  const addLog = (msg, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [
      { text: `[${timestamp}] ${msg}`, type },
      ...prev.slice(0, 15)
    ]);
  };

  // 1. Fetch current status on mount
  useEffect(() => {
    checkConnectionStatus();
    addLog("System initialized. Awaiting wearable synchronization.", "info");
    
    // Seed scrolling PPG animation helper loop
    let animId;
    const updatePpgVisual = () => {
      // Add a slight scroll animation to make the wave feel alive and high-speed
      ppgBufferRef.current = [...ppgBufferRef.current.slice(1), ppgBufferRef.current[ppgBufferRef.current.length - 1]];
      setWavePoints([...ppgBufferRef.current]);
      animId = setTimeout(updatePpgVisual, 80); // 12fps update for wave rendering
    };
    updatePpgVisual();

    return () => {
      clearTimeout(animId);
      closeWebSocket();
    };
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const res = await api.getBluetoothStatus();
      if (res.connected) {
        setConnectedDevice(res.device);
        setIsMocked(res.is_mocked);
        setBatteryLevel(res.battery_level);
        addLog(`Synchronized active connection with ${res.device.name}.`, "success");
        connectWebSocket();
      } else {
        // Fallback: If not connected, let's scan for simulated devices to populate list
        handleScan();
      }
    } catch (err) {
      setErrorMsg("Failed to synchronize Bluetooth status with backend API.");
      addLog("API Error: Unable to fetch connection status.", "error");
    }
  };

  // 2. Scan BLE Devices
  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setErrorMsg(null);
    addLog("Initiating high-frequency BLE scan...", "info");
    try {
      const list = await api.scanBluetoothDevices();
      setDevices(list);
      addLog(`BLE Scan completed. Discovered ${list.length} target devices.`, "success");
    } catch (err) {
      setErrorMsg("BLE Scan failed. Ensure your Bluetooth service is active.");
      addLog("BLE Scanning pipeline error.", "error");
    } finally {
      setScanning(false);
    }
  };

  // 3. Connect Wearable
  const handleConnect = async (address, name) => {
    setConnectingAddress(address);
    setErrorMsg(null);
    addLog(`Establishing GATT secure channel to ${name} (${address})...`, "info");
    
    try {
      const res = await api.connectBluetoothDevice(address);
      if (res.status === "connected") {
        setConnectedDevice(res.device);
        setIsMocked(res.is_mocked);
        setBatteryLevel(res.battery_level || 100);
        addLog(`✓ BLE handshake finalized. Connected to ${res.device.name}.`, "success");
        // Start streaming WebSocket
        connectWebSocket();
      } else {
        setErrorMsg(res.message || "Failed to establish connection.");
        addLog(`✗ Connection failed to ${name}.`, "error");
      }
    } catch (err) {
      setErrorMsg(err.message || "BLE connection timeout.");
      addLog(`Connection attempt to ${name} failed.`, "error");
    } finally {
      setConnectingAddress(null);
    }
  };

  // 4. Disconnect Wearable
  const handleDisconnect = async () => {
    if (!connectedDevice) return;
    addLog(`Terminating connection with ${connectedDevice.name}...`, "info");
    closeWebSocket();
    try {
      await api.disconnectBluetoothDevice();
      addLog(`Wearable disconnected cleanly. System on standby.`, "success");
    } catch (err) {
      addLog("Failed to disconnect cleanly. Resetting interface.", "error");
    } finally {
      setConnectedDevice(null);
      setBatteryLevel(null);
      setIsMocked(true);
    }
  };

  // 5. WebSocket Telemetry Stream Management
  const connectWebSocket = () => {
    closeWebSocket();
    setWsStatus("connecting");
    const wsUrl = api.getBluetoothStreamUrl();
    addLog(`Opening real-time sensor WebSocket pipeline...`, "info");

    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      addLog("✓ WebSocket pipeline status: ACTIVE (1Hz streaming)", "success");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update telemetry state
        setTelemetry(data.telemetry);
        
        // Update AI Analysis
        setAiAnalysis(data.ai_analysis);
        
        // Update Fusion details
        setFusion(data.fusion_contribution);

        // Update battery if provided
        if (data.device_status && data.device_status.battery_level !== undefined) {
          setBatteryLevel(data.device_status.battery_level);
        }

        // Push PPG value into rolling plot buffer (creating a beautiful scrolling curve)
        const ppgVal = data.telemetry.ppg_waveform;
        ppgBufferRef.current = [...ppgBufferRef.current.slice(1), ppgVal];
        
      } catch (err) {
        console.error("Error parsing WebSocket JSON telemetry:", err);
      }
    };

    ws.onerror = (err) => {
      addLog("WebSocket interface experienced a data-transport exception.", "error");
      setWsStatus("disconnected");
    };

    ws.onclose = () => {
      addLog("WebSocket telemetry stream closed.", "info");
      setWsStatus("disconnected");
    };
  };

  const closeWebSocket = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = None;
    }
    setWsStatus("disconnected");
  };

  // Waveform plot coordinates generation
  const getWavePath = () => {
    const width = 500;
    const height = 110;
    const padding = 10;
    const step = width / (wavePoints.length - 1);
    
    return wavePoints.map((val, idx) => {
      const x = idx * step;
      // Convert value range [-1.0, 1.0] to visual height coordinates
      const y = (height / 2) - (val * (height / 2 - padding));
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Physiological Intelligence Console</div>
          <div className="page-subtitle">
            Direct BLE clinical telemetry ingestion and real-time BiLSTM neural stress estimation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${wsStatus === 'connected' ? 'badge-live' : wsStatus === 'connecting' ? 'badge-amber' : 'badge-muted'}`}>
            <span className={`status-dot ${wsStatus === 'connected' ? 'live' : wsStatus === 'connecting' ? 'warn' : 'idle'}`} />
            WS: {wsStatus}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleScan} disabled={scanning}>
            <RefreshCw style={{ width: 13, height: 13, ...(scanning ? { animation: 'spin 1s linear infinite' } : {}) }} />
            Scan Devices
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="alert alert-error">
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Three Column Console Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 16 }}>
        
        {/* ================= COLUMN 1: WEARABLE DEVICE CENTER ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Connection Status Card */}
          <div className="card card-accent-cyan" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Device Status</div>
            
            {connectedDevice ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 10, borderRadius: 8, background: 'rgba(6,182,212,0.1)', color: 'var(--cyan)' }}>
                    <Wifi style={{ width: 22, height: 22, animation: 'pulse 1.5s infinite' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {connectedDevice.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                      {connectedDevice.address}
                    </div>
                  </div>
                </div>

                <div className="divider" style={{ margin: '4px 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="card card-xs" style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Battery</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Battery style={{
                        width: 14, height: 14,
                        color: batteryLevel > 50 ? 'var(--emerald)' : batteryLevel > 20 ? 'var(--amber)' : 'var(--rose)'
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {batteryLevel !== null ? `${batteryLevel}%` : 'Reading...'}
                      </span>
                    </div>
                  </div>

                  <div className="card card-xs" style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Source</span>
                    <span className="badge badge-cyan" style={{ width: 'fit-content', padding: '1px 6px', fontSize: 9 }}>
                      {isMocked ? "Simulated" : "Direct BLE"}
                    </span>
                  </div>
                </div>

                <button className="btn btn-secondary btn-sm" onClick={handleDisconnect} style={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.2)', width: '100%', justifyContent: 'center' }}>
                  <Power style={{ width: 13, height: 13 }} />
                  Terminate Connection
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Radio style={{ width: 32, height: 32, color: 'var(--text-muted)', opacity: 0.5, animation: 'pulse 2.5s infinite' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No Active Wearable</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Scan and connect a BLE health band to stream diagnostics.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Discovery List */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Wearable Discovery</span>
              {scanning && <span style={{ fontSize: 10, color: 'var(--cyan)', fontFamily: 'IBM Plex Mono' }}>Scanning...</span>}
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
              {devices.length > 0 ? (
                devices.map(device => {
                  const isConnecting = connectingAddress === device.address;
                  return (
                    <div
                      key={device.address}
                      className="card card-xs"
                      style={{
                        background: 'var(--bg-elevated)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        borderColor: connectedDevice?.address === device.address ? 'rgba(6,182,212,0.3)' : 'var(--bg-border)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{device.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>{device.address}</div>
                        </div>
                        <span className={`badge ${device.is_mock ? 'badge-muted' : 'badge-cyan'}`} style={{ fontSize: 8 }}>
                          {device.is_mock ? "Mock" : "Real BLE"}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>
                          RSSI: {device.rssi} dBm
                        </span>
                        
                        {connectedDevice?.address === device.address ? (
                          <span style={{ fontSize: 10, color: 'var(--emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="status-dot live" style={{ width: 5, height: 5 }} /> Connected
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleConnect(device.address, device.name)}
                            disabled={isConnecting || connectedDevice !== null}
                          >
                            {isConnecting ? "Linking..." : "Pair Device"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  Click Scan Devices to discover wearables.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= COLUMN 2: LIVE SENSOR MONITORING ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Main ECG Waveform console card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="section-title">Live Plethysmogram Waveform (PPG)</span>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: -8 }}>
                  Continuously plotting infrared blood oxygen pulse volume from photodiode array
                </div>
              </div>
              <span className="badge badge-cyan" style={{ fontSize: 9 }}>
                <Activity style={{ width: 11, height: 11 }} /> Real-time
              </span>
            </div>

            {/* Scrolling Waveform Drawing area */}
            <div style={{
              height: 120,
              background: '#040712',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255,255,255,0.03)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Clinical Grid lines background */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.04) 1px, transparent 1px)',
                backgroundSize: '15px 15px'
              }} />

              {/* Glowing ECG trace path */}
              <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}>
                <path
                  d={getWavePath()}
                  fill="none"
                  stroke="var(--cyan)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.75))',
                    transition: 'd 0.08s linear'
                  }}
                />
              </svg>

              {/* Status overlays if disconnected */}
              {!connectedDevice && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(4,7,18,0.75)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'var(--text-muted)', zIndex: 2
                }}>
                  Awaiting Wearable Signal...
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid-3" style={{ gap: 12 }}>
            
            {/* Heart Rate Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Heart Rate</span>
                <Heart style={{
                  width: 14,
                  height: 14,
                  color: 'var(--rose)',
                  fill: 'var(--rose)',
                  animation: telemetry.heart_rate > 90 ? 'pulse 0.7s infinite' : 'pulse 1.3s infinite'
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? telemetry.heart_rate : '--'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>BPM</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Activity: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{connectedDevice ? telemetry.activity_level : 'Idle'}</span>
              </div>
            </div>

            {/* HRV Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Autonomic HRV</span>
                <Zap style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? telemetry.heart_rate_variability : '--'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ms</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Status: <span style={{
                  fontWeight: 600,
                  color: telemetry.heart_rate_variability >= 50 ? 'var(--emerald)' : telemetry.heart_rate_variability >= 35 ? 'var(--amber)' : 'var(--rose)'
                }}>
                  {connectedDevice ? (telemetry.heart_rate_variability >= 50 ? 'Optimal recovery' : telemetry.heart_rate_variability >= 35 ? 'Moderate fatigue' : 'Sympathetic stress') : 'Idle'}
                </span>
              </div>
            </div>

            {/* SpO2 Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Blood Oxygen SpO2</span>
                <Compass style={{ width: 14, height: 14, color: 'var(--emerald)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? telemetry.spo2 : '--'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Vascular: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{connectedDevice ? (telemetry.spo2 >= 95 ? 'Normal perfusion' : 'Sub-optimal') : 'Idle'}</span>
              </div>
            </div>
          </div>

          {/* Secondary Telemetry row: Steps, GSR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            
            {/* Steps & Energy */}
            <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: 'var(--emerald)' }}>
                <Footprints style={{ width: 20, height: 20 }} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="stat-label" style={{ display: 'block' }}>Daily Activity steps</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? telemetry.steps.toLocaleString() : '--'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Flame style={{ width: 11, height: 11, color: 'var(--amber)' }} />
                    {connectedDevice ? Math.round(telemetry.steps * 0.04) : 0} kcal
                  </span>
                </div>
              </div>
            </div>

            {/* Galvanic Skin Response */}
            <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(124,58,237,0.1)', color: 'var(--violet)' }}>
                <Cpu style={{ width: 20, height: 20 }} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="stat-label" style={{ display: 'block' }}>Galvanic Skin GSR</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? `${telemetry.galvanic_skin_response} uS` : '--'}
                </span>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Electrodermal: <span style={{ color: 'var(--text-secondary)' }}>{connectedDevice ? (telemetry.galvanic_skin_response > 4.5 ? 'Arousal state' : 'Baseline tonic') : 'Idle'}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Console Terminal Logs */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 130 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>GATT Telemetry Stream Log</span>
            <div className="terminal" style={{ flex: 1, maxHeight: 150 }}>
              {systemLogs.map((log, idx) => (
                <div key={idx} className={
                  log.type === 'success' ? 'terminal-line-success' :
                  log.type === 'error' ? 'terminal-line-error' :
                  'terminal-line-info'
                }>
                  {log.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= COLUMN 3: AI PHYSIOLOGICAL ANALYSIS & FUSION ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* BiLSTM Stress Card */}
          <div className="card card-accent-rose" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-title" style={{ marginBottom: 0 }}>BiLSTM Neural stress classification</span>
              <span className="badge badge-rose" style={{ fontSize: 9 }}>BiLSTM Model</span>
            </div>

            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono' }}>
                Stress Probability Index
              </span>
              <div style={{
                fontSize: 42,
                fontWeight: 800,
                color: aiAnalysis.stress_index >= 0.70 ? 'var(--rose)' : aiAnalysis.stress_index >= 0.40 ? 'var(--amber)' : 'var(--emerald)',
                fontFamily: 'IBM Plex Sans',
                lineHeight: 1.1,
                marginTop: 4
              }}>
                {connectedDevice ? `${Math.round(aiAnalysis.stress_index * 100)}%` : '--'}
              </div>
              <span className={`badge ${
                aiAnalysis.risk_classification?.toLowerCase() === 'high' ? 'badge-rose' :
                aiAnalysis.risk_classification?.toLowerCase() === 'medium' ? 'badge-amber' :
                'badge-live'
              }`} style={{ marginTop: 6 }}>
                {connectedDevice ? `${aiAnalysis.risk_classification} stress risk` : 'No Signal'}
              </span>
            </div>

            {/* Visual stress index meter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                <span>Homeostatic Balance</span>
                <span>Hyperarousal</span>
              </div>
              <div className="meter-bar" style={{ height: 6 }}>
                <div
                  className={`meter-fill ${
                    aiAnalysis.stress_index >= 0.70 ? 'rose' :
                    aiAnalysis.stress_index >= 0.40 ? 'amber' :
                    'emerald'
                  }`}
                  style={{ width: connectedDevice ? `${aiAnalysis.stress_index * 100}%` : '0%' }}
                />
              </div>
            </div>

            <div className="divider" style={{ margin: '4px 0' }} />

            {/* Stress pattern insights */}
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: 4 }}>
                Clinical Diagnostics Narrative
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, border: '1px solid var(--bg-border)' }}>
                {connectedDevice ? aiAnalysis.stress_pattern : "System idle. Awaiting biometric telemetry streams to generate diagnostic insights."}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>AI confidence score:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>
                {connectedDevice ? `${Math.round(aiAnalysis.confidence_score * 100)}%` : '--'}
              </span>
            </div>
          </div>

          {/* Physiological Anomalies Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>Anomalies Detected</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {connectedDevice ? (
                aiAnalysis.anomaly_flags.length > 0 ? (
                  aiAnalysis.anomaly_flags.map((anomaly, idx) => (
                    <div key={idx} className="alert alert-error" style={{ padding: '8px 12px', fontSize: 11, borderRadius: 8 }}>
                      <AlertCircle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
                      <span>{anomaly}</span>
                    </div>
                  ))
                ) : (
                  <div className="alert alert-success" style={{ padding: '8px 12px', fontSize: 11, borderRadius: 8, background: 'rgba(16,185,129,0.06)' }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: 'var(--emerald)', flexShrink: 0, marginTop: 1 }} />
                    <span>Autonomic biomarkers within homeostatic norms.</span>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  Awaiting wearable connection...
                </div>
              )}
            </div>
          </div>

          {/* Attention Fusion Card */}
          <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>Central Attention Fusion</span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(124,58,237,0.1)', color: 'var(--violet)' }}>
                <Layers style={{ width: 20, height: 20 }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', display: 'block' }}>
                  Attention Weight Contribution
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? `${Math.round(fusion.sensor_weight * 100)}%` : '--'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <div className="meter-bar" style={{ height: 4 }}>
                <div className="meter-fill violet" style={{ width: connectedDevice ? `${fusion.sensor_weight * 100}%` : '0%' }} />
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
              The Attention Fusion engine allocates <span style={{ color: 'var(--violet)', fontWeight: 600 }}>{connectedDevice ? `${Math.round(fusion.sensor_weight * 100)}%` : '0%'}</span> of the overall patient wellness score weighting to this stream, generating a 
              <span style={{
                color: fusion.sensor_contribution === 'positive_influence' ? 'var(--emerald)' : 'var(--rose)',
                fontWeight: 600
              }}>
                {" "}{fusion.sensor_contribution === 'positive_influence' ? 'positive wellness boost' : 'negative clinical warning'}
              </span> in the unified metrics matrix.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
