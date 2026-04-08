import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import AssessmentPage from "./pages/AssessmentPage";
import ChatPage from "./pages/ChatPage";
import DashboardPage from "./pages/DashboardPage";
import ForumPage from "./pages/ForumPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  const location = useLocation();
  const hideGlobalNav = location.pathname === "/" || location.pathname === "/login";

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideGlobalNav && <Navbar />}

      <div className={hideGlobalNav ? "" : "max-w-7xl mx-auto px-4 py-8"}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/home"
            element={
              localStorage.getItem("token") ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="/login" element={<LoginPage />} />
          
          <Route
            path="/assessment"
            element={
              <ProtectedRoute>
                <AssessmentPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/forum"
            element={
              <ProtectedRoute>
                <ForumPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/results"
            element={
              <ProtectedRoute>
                <ResultsPage />
              </ProtectedRoute>
            }
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
