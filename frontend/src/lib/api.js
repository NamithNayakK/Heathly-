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
  }
};
