import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Brain, ChevronRight, Clock, MessageSquare, Send,
  Shield, TrendingUp, Zap
} from "lucide-react";
import { api } from "../lib/api";

const EMOTION_MAP = {
  anger: { emoji: '😠', color: 'var(--rose)' },
  fear: { emoji: '😨', color: 'var(--amber)' },
  sadness: { emoji: '😢', color: 'var(--blue)' },
  joy: { emoji: '😊', color: 'var(--emerald)' },
  surprise: { emoji: '😮', color: 'var(--cyan)' },
  disgust: { emoji: '🤢', color: 'var(--rose)' },
  neutral: { emoji: '😐', color: 'var(--text-muted)' },
};

function EmotionBadge({ emotion, confidence }) {
  const meta = EMOTION_MAP[emotion?.toLowerCase()] || { emoji: '❓', color: 'var(--text-muted)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className="emotion-chip">
        <span>{meta.emoji}</span>
        <span>{emotion || 'Unknown'}</span>
      </span>
      {confidence != null && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    api.getChatHistory()
      .then(d => setHistory(d.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError("");
    const msg = message;
    setMessage("");
    try {
      const res = await api.sendMessage(msg);
      setHistory(prev => [{ id: Date.now(), user_message: msg, bot_response: res.response, emotion: res.emotion, confidence: res.confidence, escalation_required: res.escalation_required, created_at: new Date().toISOString() }, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const emotions = history.filter(h => h.emotion).map(h => h.emotion?.toLowerCase()).slice(0, 10);
  const emotionCounts = emotions.reduce((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {});
  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const escalations = history.filter(h => h.escalation_required).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="page-title">AI Cognitive Companion</div>
        <div className="page-subtitle">CBT-aligned conversational AI with real-time emotional intelligence analysis</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>

        {/* Main Chat Panel */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', overflow: 'hidden' }}>
          {/* Chat Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--violet-dim)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain style={{ width: 16, height: 16, color: 'var(--violet)' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Healthly AI Companion</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="status-dot live" style={{ width: 5, height: 5 }} />
                CBT · NLP · Sentiment Analysis
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loadingHistory ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[80, 120, 60].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 10 }} />)}
              </div>
            ) : history.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                <MessageSquare style={{ width: 32, height: 32 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Begin your first session</div>
                <div style={{ fontSize: 12, maxWidth: 300, lineHeight: 1.6 }}>Share how you're feeling. The AI analyzes your language patterns in real-time for emotional and cognitive signals.</div>
              </div>
            ) : (
              [...history].reverse().map(item => (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="chat-bubble-user">{item.user_message}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="chat-bubble-bot">{item.bot_response}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                      <EmotionBadge emotion={item.emotion} confidence={item.confidence} />
                      {item.escalation_required && (
                        <span className="badge badge-rose">
                          <AlertTriangle style={{ width: 9, height: 9 }} /> Escalation Flag
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginLeft: 'auto' }}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          {error && (
            <div className="alert alert-error" style={{ margin: '0 18px', borderRadius: 8 }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={send} style={{ padding: '12px 18px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 8 }}>
            <input
              className="input-field"
              placeholder="Describe your emotional state, thoughts, or concerns..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={sending}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" disabled={sending || !message.trim()} style={{ flexShrink: 0 }}>
              {sending ? '...' : <Send style={{ width: 14, height: 14 }} />}
            </button>
          </form>
        </div>

        {/* Right Analytics Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-sm card-accent-violet">
            <div className="section-title">Session Analytics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total sessions</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{history.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dominant emotion</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {topEmotion || '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Escalation flags</span>
                <span className={`badge ${escalations > 0 ? 'badge-rose' : 'badge-live'}`}>{escalations}</span>
              </div>
            </div>
          </div>

          <div className="card card-sm">
            <div className="section-title">Emotional Trend</div>
            {history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(emotionCounts).slice(0, 5).map(([emotion, count]) => (
                  <div key={emotion} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{emotion}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>{count}</span>
                    </div>
                    <div className="meter-bar" style={{ height: 3 }}>
                      <div className="meter-fill violet" style={{ width: `${(count / history.length) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                Start chatting to build emotional trend data
              </div>
            )}
          </div>

          <div className="card card-sm" style={{ background: 'var(--cyan-dim)', borderColor: 'rgba(6,182,212,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Shield style={{ width: 12, height: 12, color: 'var(--cyan)' }} />
              <span style={{ fontSize: 10, color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Privacy Protected
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Conversations are encrypted and processed with clinical-grade confidentiality.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
