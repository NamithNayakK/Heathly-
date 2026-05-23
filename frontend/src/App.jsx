import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ProtectedRoute from "./components/ProtectedRoute";
import AssessmentPage from "./pages/AssessmentPage";
import ChatPage from "./pages/ChatPage";
import ComprehensiveAssessmentPage from "./pages/ComprehensiveAssessmentPage";
import DashboardPage from "./pages/DashboardPage";
import ForumPage from "./pages/ForumPage";
import HealthReportPage from "./pages/HealthReportPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ResultsPage from "./pages/ResultsPage";
import SensorPage from "./pages/SensorPage";

function AppShell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <Topbar />
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isPublic = ['/', '/login'].includes(location.pathname);

  if (isPublic) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </div>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/home" element={
          localStorage.getItem("token")
            ? <Navigate to="/dashboard" replace />
            : <Navigate to="/login" replace />
        } />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/assessment" element={<ProtectedRoute><AssessmentPage /></ProtectedRoute>} />
        <Route path="/health-report" element={<ProtectedRoute><HealthReportPage /></ProtectedRoute>} />
        <Route path="/sensor" element={<ProtectedRoute><SensorPage /></ProtectedRoute>} />
        <Route path="/comprehensive-assessment" element={<ProtectedRoute><ComprehensiveAssessmentPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/forum" element={<ProtectedRoute><ForumPage /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
