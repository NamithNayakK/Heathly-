const getApiBaseUrl = () => {
  const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isLocalDev) {
    return "/api/v1";
  }

  return import.meta.env.VITE_API_BASE_URL || "/api/v1";
};

const API_BASE_URL = getApiBaseUrl();

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const { headers, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    ...rest,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Request failed");
  }

  return response.json();
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/auth/me"),
  submitPHQ9: (answers) => request("/assessment/phq9", { method: "POST", body: JSON.stringify({ answers }) }),
  getPHQ9History: () => request("/assessment/phq9/history", { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
  sendMessage: (message) => request("/chat/message", { method: "POST", body: JSON.stringify({ message }) }),
  getChatHistory: () => request("/chat/history"),
  listForumPosts: () => request("/forum/posts"),
  createForumPost: (payload) => request("/forum/posts", { method: "POST", body: JSON.stringify(payload) }),
  
  // Comprehensive multimodal assessment
  submitHealthReport: (filename, raw_text) => 
    request("/multimodal/report", { 
      method: "POST", 
      body: JSON.stringify({ filename, raw_text }) 
    }),
  submitSensorData: (sensorData) => 
    request("/multimodal/sensor", { 
      method: "POST", 
      body: JSON.stringify(sensorData) 
    }),
  submitSessionAnalytics: (sessionData) => 
    request("/multimodal/session", { 
      method: "POST", 
      body: JSON.stringify(sessionData) 
    }),
  analyzeFrame: (image_base64) => 
    request("/multimodal/analyze-frame", { 
      method: "POST", 
      body: JSON.stringify({ image_base64 }) 
    }),
  getMultimodalDashboard: () => 
    request("/multimodal/dashboard", { 
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } 
    }),
  submitComprehensiveAssessment: (assessmentData) => 
    request("/multimodal/comprehensive-assessment", { 
      method: "POST", 
      body: JSON.stringify(assessmentData) 
    }),

  // Bluetooth & Wearables Integration
  scanBluetoothDevices: () => request("/bluetooth/devices"),
  connectBluetoothDevice: (address) => request("/bluetooth/connect", { method: "POST", body: JSON.stringify({ address }) }),
  disconnectBluetoothDevice: () => request("/bluetooth/disconnect", { method: "POST" }),
  getBluetoothStatus: () => request("/bluetooth/status", { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
  getBluetoothStreamUrl: () => {
    const isAbsoluteUrl = /^https?:\/\//.test(API_BASE_URL);
    if (isAbsoluteUrl) {
      const isSecure = API_BASE_URL.startsWith("https:");
      const base = API_BASE_URL.replace(/^http/, isSecure ? "wss" : "ws");
      return `${base}/bluetooth/stream`;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${window.location.host}${API_BASE_URL}/bluetooth/stream`;
  },

  // Admin endpoints
  getAdminUsers: () => request("/admin/users"),
  updateUserRole: (userId, role) => request(`/admin/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
  getAdminStats: () => request("/admin/stats"),

  // Consultant / Admin shared endpoints
  getPatients: () => request("/admin/patients"),
  getPatientSensorData: (patientId) => request(`/admin/patients/${patientId}/sensor-data`),

  // WiFi Telemetry Ingestion Endpoints
  getWifiUsers: () => request("/../../api/users"),
  getWifiHistory: (userId, limit = 20) => request(`/../../api/users/${userId}/history?limit=${limit}`),
  getWifiRecommendations: (userId) => request(`/../../api/users/${userId}/recommendations`),
  getWifiTrends: (userId) => request(`/../../api/users/${userId}/trends`),
  getWifiLatest: (userId) => request(`/../../api/users/${userId}/latest`),
  getWifiRisk: (userId) => request(`/../../api/users/${userId}/risk`),
  submitWifiPHQ9: (userId, answers) => request("/../../api/phq9-assessment", { method: "POST", body: JSON.stringify({ user_id: userId, answers }) }),
  getWifiStreamUrl: (userId) => {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `${window.location.hostname}:8000`
      : window.location.host;
    return `${wsProtocol}//${host}/ws/dashboard/${userId}`;
  },
};

