import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, MessageSquare, Send, Shield, Heart, Sparkles, PhoneCall } from "lucide-react";
import { api } from "../lib/api";

const EMOTION_MAP = {
  anger:    { emoji: "⚡", color: "#F87171", label: "Heightened Tension" },
  fear:     { emoji: "🌧️", color: "var(--amber)", label: "Anxiety Marker" },
  sadness:  { emoji: "💧", color: "var(--lav)", label: "Low Valence" },
  joy:      { emoji: "🌿", color: "var(--teal)", label: "Positive Affect" },
  surprise: { emoji: "✨", color: "#2DD4BF", label: "Cognitive Shift" },
  disgust:  { emoji: "○",  color: "#94A3B8", label: "Aversive" },
  neutral:  { emoji: "—",  color: "var(--text-muted)", label: "Balanced" },
};

function EmotionIndicator({ emotion, confidence }) {
  const meta = EMOTION_MAP[emotion?.toLowerCase()] || EMOTION_MAP.neutral;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {meta.label} {confidence != null && `(${(confidence * 100).toFixed(0)}%)`}
      </span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "10px 16px", background: "rgba(29, 107, 95, 0.12)", borderRadius: "18px 18px 18px 4px", width: "fit-content", border: "1px solid rgba(29, 107, 95, 0.25)" }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
          style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--teal)" }}
        />
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [message, setMessage]         = useState("");
  const [history, setHistory]         = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    api.getChatHistory()
      .then(d => setHistory(d.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, sending]);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true); setError("");
    const msg = message;
    setMessage("");
    try {
      const res = await api.sendMessage(msg);
      setHistory(prev => [{
        id: Date.now(), user_message: msg,
        bot_response: res.response, emotion: res.emotion,
        confidence: res.confidence, escalation_required: res.escalation_required,
        created_at: new Date().toISOString(),
      }, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const emotions     = history.map(h => h.emotion?.toLowerCase()).filter(Boolean).slice(0, 10);
  const emotionCounts= emotions.reduce((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {});
  const topEmotion   = Object.entries(emotionCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const escalations  = history.filter(h => h.escalation_required).length;
  const topMeta      = topEmotion ? EMOTION_MAP[topEmotion] || EMOTION_MAP.neutral : null;

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, borderBottom: "1px solid var(--bg-border)", paddingBottom: 20 }}>
        <div>
          <div className="editorial-eyebrow dark" style={{ marginBottom: 6 }}>
            CLINICAL COGNITIVE DIALOGUE
          </div>
          <h1 className="page-title font-display" style={{ fontSize: "clamp(1.8rem, 2.8vw, 2.4rem)", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
            AI Wellness Companion
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, margin: "4px 0 0" }}>
            CBT-guided reflection with real-time DistilBERT affective semantic recognition.
          </p>
        </div>

        {/* Confidentiality Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", padding: "6px 14px", borderRadius: 20, border: "1px solid var(--bg-border)" }}>
          <Shield size={14} style={{ color: "var(--brand)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>Zero-knowledge ephemeral chat</span>
        </div>
      </div>

      {/* Safety Lifeline Banner */}
      <div style={{ padding: "12px 18px", borderRadius: 12, background: "rgba(244, 63, 94, 0.08)", border: "1px solid rgba(244, 63, 94, 0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Heart size={16} style={{ color: "#F43F5E" }} />
          <span style={{ fontSize: 12, color: "#E2E8F0" }}>
            In acute crisis? Immediate 24/7 confidential support is available nationwide.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "IBM Plex Mono", color: "#FDA4AF" }}>
          <PhoneCall size={12} />
          <span>Dial or text <strong>988</strong></span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

        {/* ── MAIN CHAT PANEL ── */}
        <div className="bento-card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 270px)", overflow: "hidden", border: "1px solid var(--bg-border)" }}>
          
          {/* Chat Sub-Header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--bg-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF" }}>
                <Sparkles size={14} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>Reflective Session</span>
            </div>
            <span className="badge badge-live" style={{ fontSize: 9 }}>
              DistilBERT Active
            </span>
          </div>

          {/* Messages Stream */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
            {loadingHistory ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[70, 110, 60].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />)}
              </div>
            ) : history.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(29, 107, 95, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--teal)" }}>
                  <MessageSquare size={22} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF", fontFamily: "Fraunces, serif" }}>Open your mind</div>
                <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                  Share how today felt or what thoughts are circulating. The companion reflects patterns back to you with calmness and clinical neutrality.
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {[...history].reverse().map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {/* User message */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div className="chat-bubble-user" style={{ background: "rgba(29, 107, 95, 0.18)", borderColor: "rgba(29, 107, 95, 0.35)", borderRadius: "16px 16px 4px 16px", padding: "12px 18px", fontSize: 14 }}>
                        {item.user_message}
                      </div>
                    </div>

                    {/* Bot response */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: "85%" }}>
                      <div className="chat-bubble-bot" style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", borderRadius: "16px 16px 16px 4px", padding: "14px 18px", fontSize: 14, lineHeight: 1.65 }}>
                        {item.bot_response}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 6 }}>
                        {item.emotion && <EmotionIndicator emotion={item.emotion} confidence={item.confidence} />}
                        {item.escalation_required && (
                          <span className="badge badge-amber">
                            <AlertTriangle size={9} /> Clinical check recommended
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", marginLeft: "auto" }}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {sending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TypingIndicator />
              </motion.div>
            )}
            <div ref={endRef} />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="alert alert-warn" style={{ margin: "0 16px 8px", borderRadius: 8 }}>
              <AlertTriangle size={13} /> <span>{error}</span>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={send} style={{ padding: "14px 18px", borderTop: "1px solid var(--bg-border)", display: "flex", gap: 10, background: "var(--surface)" }}>
            <input
              className="input-field"
              placeholder="What thoughts or feelings are on your mind right now?"
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={sending}
              style={{ flex: 1, padding: "12px 18px", borderRadius: 24, fontSize: 13 }}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={sending || !message.trim()}
              style={{ borderRadius: 24, padding: "0 20px", background: "var(--brand)", color: "#FFFFFF", borderColor: "transparent", flexShrink: 0 }}
            >
              {sending ? "..." : <Send size={15} />}
            </button>
          </form>
        </div>

        {/* ── SIDE ANALYTICS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary Card */}
          <div className="bento-card" style={{ padding: 20 }}>
            <div className="section-title">Linguistic Markers</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Total Exchanges</span>
                <span style={{ fontWeight: 600, color: "#FFFFFF", fontFamily: "IBM Plex Mono" }}>{history.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Support Triggers</span>
                <span style={{ fontWeight: 600, color: escalations > 0 ? "var(--amber)" : "var(--emerald)", fontFamily: "IBM Plex Mono" }}>
                  {escalations}
                </span>
              </div>
              {topMeta && (
                <div style={{ borderTop: "1px solid var(--bg-border)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Prevalent Valence</span>
                  <span style={{ fontSize: 11, color: topMeta.color, fontWeight: 600, fontFamily: "IBM Plex Mono" }}>
                    {topEmotion?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Emotion Trend Breakdown */}
          {Object.entries(emotionCounts).length > 0 && (
            <div className="bento-card" style={{ padding: 20 }}>
              <div className="section-title">Affective Distribution</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {Object.entries(emotionCounts).slice(0, 5).map(([emotion, count]) => {
                  const m = EMOTION_MAP[emotion] || EMOTION_MAP.neutral;
                  return (
                    <div key={emotion} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: m.color, textTransform: "capitalize" }}>{emotion}</span>
                        <span style={{ fontFamily: "IBM Plex Mono", color: "var(--text-muted)" }}>{count}</span>
                      </div>
                      <div className="meter-bar" style={{ height: 4 }}>
                        <div style={{ width: `${(count / history.length) * 100}%`, height: "100%", background: m.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

