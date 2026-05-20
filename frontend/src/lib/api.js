const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

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
};
