import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Home,
  MessageCircle,
  Settings,
  TrendingUp,
} from "lucide-react";

import { api } from "../lib/api";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mood, setMood] = useState(null);
  const [breathingOn, setBreathingOn] = useState(false);
  const userName = localStorage.getItem("full_name") || "User";

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setError("");
      try {
        const data = await api.getPHQ9History();
        if (mounted) {
          setHistory(data.items || []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();
    return () => {
      mounted = false;
    };
  }, []);

  const latest = history[0];
  const moodHistory = ["😊", "😐", "🙂", "😕", "😊", "😊", "?"];

  const getRiskColor = (riskLevel) => {
    switch (riskLevel?.toLowerCase()) {
      case "minimal":
        return "bg-green-100 text-green-800 border-green-300";
      case "mild":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "moderate":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "moderately severe":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "severe":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel?.toLowerCase()) {
      case "minimal":
        return "😊";
      case "mild":
        return "🙂";
      case "moderate":
        return "😐";
      case "moderately severe":
        return "😞";
      case "severe":
        return "😢";
      default:
        return "❓";
    }
  };

  return (
    <main className="min-h-screen">
      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <aside className="card-glass h-fit text-slate-800">
          <div className="mb-5 flex items-center justify-between">
            {!collapsed && <p className="text-lg font-semibold">Workspace</p>}
            <button className="rounded bg-indigo-50 px-3 py-1 text-sm" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          <div className="space-y-2">
            {[
              { label: "Dashboard", icon: Home, path: "/dashboard" },
              { label: "Assessment", icon: ClipboardList, path: "/assessment" },
              { label: "My Progress", icon: TrendingUp, path: "/results" },
              { label: "Chat Support", icon: MessageCircle, path: "/chat" },
              { label: "Resources", icon: BookOpen, path: "/forum" },
              { label: "Settings", icon: Settings, path: "/dashboard" },
            ].map((item) => (
              <button
                key={item.label}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4 text-teal-600" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="card-gradient">
            <h1 className="text-3xl font-bold">Hello, {userName}</h1>
            <p className="mt-2 text-white/90">Welcome back. Here is your current wellness snapshot.</p>
          </div>

        {/* Latest Assessment Card */}
          {latest?.high_risk && (
            <div className="crisis-banner">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Need immediate help?</p>
                <p className="text-sm">Call: 1-800-273-8255 (24/7 Helpline)</p>
              </div>
              <button className="ml-auto rounded-lg bg-white/20 px-3 py-2 text-sm">Get Help Now</button>
            </div>
          )}

          {isLoading ? (
            <div className="card-glass loading-shimmer text-center text-slate-700">Loading your dashboard...</div>
          ) : latest ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <article className="card-glass text-slate-800">
                <h2 className="text-xl font-semibold">Current Risk Status</h2>
                <div className="mt-4 flex items-center gap-5">
                  <div className="relative h-28 w-28">
                    <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke="url(#riskGradient)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={301.59}
                        strokeDashoffset={301.59 * (1 - Math.min(latest.score / 27, 1))}
                      />
                      <defs>
                        <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#14b8a6" />
                          <stop offset="100%" stopColor="#0f766e" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-teal-700">{latest.score}</div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Current status</p>
                    <p className={`mt-1 inline-flex items-center rounded-lg px-3 py-1 font-semibold ${getRiskColor(latest.risk_level)}`}>
                      {getRiskIcon(latest.risk_level)} {latest.risk_level}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{latest.recommended_action}</p>
                  </div>
                </div>
              </article>

              <article className="card-glass text-slate-800">
                <h2 className="text-xl font-semibold">How are you feeling today?</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["😢", "😕", "😐", "🙂", "😊"].map((face) => (
                    <button
                      key={face}
                      className={`interactive-chip rounded-xl px-4 py-2 text-2xl ${mood === face ? "bg-teal-100" : "bg-slate-100 hover:bg-slate-200"}`}
                      onClick={() => setMood(face)}
                    >
                      {face}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-sm text-slate-500">7-day trend</p>
                  <div className="mt-2 flex justify-between rounded-lg bg-slate-100 px-3 py-2 text-xl">
                    {moodHistory.map((icon, idx) => (
                      <span key={idx}>{icon}</span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="card-glass text-slate-800">
                <h2 className="text-xl font-semibold">Take a Deep Breath</h2>
                <div className="mt-4 flex items-center gap-6">
                  <motion.div
                    className="h-24 w-24 rounded-full bg-teal-500"
                    animate={{ scale: breathingOn ? [1, 1.15, 1] : 1 }}
                    transition={{ repeat: breathingOn ? Infinity : 0, duration: 4 }}
                  />
                  <div>
                    <p className="text-sm text-slate-600">{breathingOn ? "Breathe in... 4s" : "Ready for a calming exercise"}</p>
                    <button className="btn-secondary btn-ripple focus-ring mt-3" onClick={() => setBreathingOn((v) => !v)}>
                      {breathingOn ? "Stop Exercise" : "Start Exercise"}
                    </button>
                  </div>
                </div>
              </article>

              <article className="card-glass text-slate-800">
                <h2 className="text-xl font-semibold">Quick Actions</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button className="btn-primary btn-ripple focus-ring" onClick={() => navigate("/assessment")}>Take Assessment</button>
                  <button className="btn-secondary btn-ripple focus-ring" onClick={() => navigate("/chat")}>Talk to AI Bot</button>
                </div>
              </article>
            </div>
          ) : (
            <div className="card-glass text-center">
              <p className="text-slate-700">No assessment found yet.</p>
              <button onClick={() => navigate("/assessment")} className="btn-primary btn-ripple focus-ring mt-4">Take Your First Assessment</button>
            </div>
          )}

          <div className="card-glass">
            <h2 className="text-xl font-semibold text-slate-800">Assessment History</h2>
            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>}
            {!isLoading && history.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, index) => (
                      <tr key={`${item.created_at}-${index}`} className="border-b border-slate-100">
                        <td className="px-3 py-2">{new Date(item.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{item.score}/27</td>
                        <td className="px-3 py-2">{item.risk_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
