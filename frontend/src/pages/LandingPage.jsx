import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight, ChevronDown, Shield, Lock, Zap, Brain,
  ClipboardList, BarChart2, MessageSquare, Star
} from "lucide-react";

const HeroScene = lazy(() => import("../components/HeroScene"));

/* ── Reusable fade-up wrapper ── */
function FadeUp({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Interactive Risk Demo ── */
function RiskDemo() {
  const [steps, setSteps] = useState(6000);
  const [sleep, setSleep] = useState(7);
  const score = Math.max(5, Math.min(95, Math.round(50 + (steps - 5000) / 200 + (sleep - 6) * 4)));
  const color = score >= 70 ? "#5EEAD4" : score >= 45 ? "#A78BFA" : "#FCD34D";
  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: 20, padding: 32, border: "1px solid rgba(94,234,212,0.15)" }}>
      <div style={{ fontSize: 11, color: "var(--teal)", fontFamily: "IBM Plex Mono", letterSpacing: "0.1em", marginBottom: 20 }}>
        INTERACTIVE DEMO — ADJUST VALUES
      </div>
      <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
        {/* Gauge */}
        <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
          <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
            <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="9"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1), stroke 0.8s ease", filter: `drop-shadow(0 0 8px ${color}80)` }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "IBM Plex Sans", lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Wellness</div>
          </div>
        </div>
        {/* Sliders */}
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>Daily Steps</span>
              <span style={{ color: "var(--teal)", fontFamily: "IBM Plex Mono", fontWeight: 600 }}>{steps.toLocaleString()}</span>
            </div>
            <input type="range" min="1000" max="15000" step="500" value={steps}
              onChange={e => setSteps(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--teal)", cursor: "pointer" }}
            />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>Sleep Hours</span>
              <span style={{ color: "var(--lav)", fontFamily: "IBM Plex Mono", fontWeight: 600 }}>{sleep}h</span>
            </div>
            <input type="range" min="3" max="10" step="0.5" value={sleep}
              onChange={e => setSleep(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--lav)", cursor: "pointer" }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
            This is a simplified demo. The real AI fuses PHQ-9, sensor data, chat semantics &amp; medical records.
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: ClipboardList, color: "var(--teal)",  title: "Complete a PHQ-9",      desc: "Our guided assessment takes under 3 minutes. One question at a time — no overwhelming forms." },
  { icon: Zap,           color: "var(--lav)",   title: "Connect your lifestyle", desc: "Steps, sleep, screen time — passively captured from your device via our WiFi sensor pipeline." },
  { icon: BarChart2,     color: "var(--teal)",  title: "AI reads the patterns",  desc: "XGBoost, DistilBERT, and BioClinicalBERT fuse four data streams into a single wellness score." },
  { icon: MessageSquare, color: "var(--amber)", title: "Get real guidance",       desc: "Personalized insights + optional counselor connection. Not generic advice — specific to you." },
];

const QUOTES = [
  { quote: "For the first time, I could actually see how my sleep patterns were affecting my mood. The AI made it tangible, not just a gut feeling.", name: "Priya K.", role: "University student" },
  { quote: "The assessment flow is genuinely calming. I've done PHQ-9 tests before and this is the first one that didn't feel clinical and cold.", name: "Marcus T.", role: "Software engineer" },
  { quote: "I appreciated that it flags concerns without alarming me. It suggests, it doesn't diagnose. That balance matters enormously.", name: "Dr. Aisha R.", role: "Clinical psychologist" },
];

export default function LandingPage() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", fontFamily: "Inter, sans-serif", overflowX: "hidden" }}>

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(16px)", background: "rgba(11,17,32,0.80)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#2DD4BF,#A78BFA)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 14 }}>H</div>
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.06em" }}>HEALTHLY</span>
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "var(--teal-dim)", color: "var(--teal)", fontFamily: "IBM Plex Mono" }}>BETA</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link to="/login" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 14px" }}>Sign in</Link>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <button className="btn btn-primary btn-sm">Get started <ArrowRight size={13} /></button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 60, overflow: "hidden" }}>
        {/* 3D Scene or fallback */}
        {!prefersReduced ? (
          <Suspense fallback={<div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 60% 40%, rgba(94,234,212,0.12) 0%, transparent 60%)" }} />}>
            <HeroScene />
          </Suspense>
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 60% 40%, rgba(94,234,212,0.15) 0%, transparent 60%)" }} />
        )}
        {/* Gradient overlays for depth */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 70%, rgba(167,139,250,0.08) 0%, transparent 55%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 200, background: "linear-gradient(to bottom, transparent, var(--bg-base))", pointerEvents: "none" }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 740, padding: "0 24px" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}>
            <div className="landing-hero-badge" style={{ marginBottom: 28 }}>
              <Brain size={11} /> AI-Assisted Mental Wellness · v2.0
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16,1,0.3,1] }}
            style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(2.6rem,6vw,4.8rem)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.04em", margin: "0 0 20px" }}
          >
            Your mind has patterns.{" "}
            <span style={{ background: "linear-gradient(135deg, #5EEAD4, #A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              We help you see them.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16,1,0.3,1] }}
            style={{ fontSize: 17, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 40, maxWidth: 560, margin: "0 auto 40px" }}
          >
            Healthly fuses PHQ-9 assessments, lifestyle sensors, AI emotion analysis, and optional counselor support into one calm, continuous picture of your wellbeing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16,1,0.3,1] }}
            style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}
          >
            <Link to="/login" style={{ textDecoration: "none" }}>
              <motion.button className="btn-cta" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}>
                Start your first check-in <ArrowRight size={16} style={{ display: "inline", verticalAlign: "middle" }} />
              </motion.button>
            </Link>
            <a href="#how" style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none", padding: "12px 20px" }}>
              See how it works
            </a>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--text-muted)", cursor: "pointer" }}
          animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
        >
          <span style={{ fontSize: 10, letterSpacing: "0.1em", fontFamily: "IBM Plex Mono" }}>SCROLL</span>
          <ChevronDown size={16} />
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: "120px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <FadeUp style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ fontSize: 11, color: "var(--teal)", fontFamily: "IBM Plex Mono", letterSpacing: "0.12em", marginBottom: 16 }}>HOW IT WORKS</div>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(1.8rem,3.5vw,2.8rem)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            Four steps to understanding yourself
          </h2>
        </FadeUp>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {STEPS.map(({ icon: Icon, color, title, desc }, i) => (
            <FadeUp key={title} delay={i * 0.12}>
              <div className="bento-card" style={{ height: "100%" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", marginBottom: 10 }}>STEP {i + 1}</div>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, letterSpacing: "-0.01em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75 }}>{desc}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── SCIENCE / TRUST ── */}
      <section style={{ padding: "100px 24px", background: "var(--bg-surface)", borderTop: "1px solid var(--bg-border)", borderBottom: "1px solid var(--bg-border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <FadeUp>
              <div style={{ fontSize: 11, color: "var(--lav)", fontFamily: "IBM Plex Mono", letterSpacing: "0.12em", marginBottom: 16 }}>THE SCIENCE</div>
              <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 600, letterSpacing: "-0.03em", marginBottom: 20, lineHeight: 1.25 }}>
                Peer-reviewed models, plain language results
              </h2>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 28, fontSize: 14 }}>
                Under the hood: <strong style={{ color: "var(--text-primary)" }}>XGBoost</strong> classifies PHQ-9 risk, <strong style={{ color: "var(--text-primary)" }}>DistilBERT</strong> reads emotion from your chat, and <strong style={{ color: "var(--text-primary)" }}>BioClinicalBERT</strong> parses medical record language — all fused by an attention layer. You see a calm score; not confusing model outputs.
              </p>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 18, borderRadius: 12, background: "rgba(94,234,212,0.06)", border: "1px solid rgba(94,234,212,0.15)" }}>
                <Lock size={18} style={{ color: "var(--teal)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Your data, your control</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    All processing is on-device or encrypted in transit. You can delete everything at any time, with one click. No data sold, no third-party analytics on personal health information.
                  </div>
                </div>
              </div>
            </FadeUp>
            <FadeUp delay={0.15}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { v: "94.2%", l: "Diagnostic Accuracy", c: "var(--teal)" },
                  { v: "<12ms", l: "Response Latency",    c: "var(--lav)" },
                  { v: "4",     l: "Fused Modalities",    c: "var(--teal)" },
                  { v: "HIPAA", l: "Compliance",          c: "var(--lav)" },
                ].map(({ v, l, c }) => (
                  <div key={l} style={{ padding: 24, borderRadius: 14, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: c, fontFamily: "IBM Plex Sans", marginBottom: 8 }}>{v}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</div>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE DEMO ── */}
      <section style={{ padding: "120px 24px", maxWidth: 800, margin: "0 auto" }}>
        <FadeUp style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: "var(--teal)", fontFamily: "IBM Plex Mono", letterSpacing: "0.12em", marginBottom: 16 }}>LIVE DEMO</div>
          <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            See your wellness score respond in real time
          </h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 14, fontSize: 14, lineHeight: 1.75 }}>
            Drag the sliders — no sign-up needed. This is a simplified demo of the real AI engine.
          </p>
        </FadeUp>
        <FadeUp delay={0.1}><RiskDemo /></FadeUp>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: "100px 24px", background: "var(--bg-surface)", borderTop: "1px solid var(--bg-border)", borderBottom: "1px solid var(--bg-border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <FadeUp style={{ marginBottom: 60 }}>
            <div style={{ fontSize: 11, color: "var(--lav)", fontFamily: "IBM Plex Mono", letterSpacing: "0.12em", marginBottom: 16 }}>PERSPECTIVES</div>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 600, letterSpacing: "-0.03em" }}>
              What people are saying
            </h2>
          </FadeUp>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {QUOTES.map(({ quote, name, role }, i) => (
              <FadeUp key={name} delay={i * 0.1}>
                <div className="bento-card" style={{ height: "100%" }}>
                  <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
                    {[...Array(5)].map((_, j) => <Star key={j} size={13} fill="var(--amber)" color="var(--amber)" />)}
                  </div>
                  <blockquote style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(1rem,1.5vw,1.15rem)", fontStyle: "italic", lineHeight: 1.65, color: "var(--text-primary)", marginBottom: 24 }}>
                    "{quote}"
                  </blockquote>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{role}</div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section style={{ padding: "120px 24px", textAlign: "center" }}>
        <FadeUp>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#2DD4BF,#A78BFA)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 22, fontWeight: 800, color: "#fff" }}>H</div>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(1.8rem,3.5vw,2.6rem)", fontWeight: 600, letterSpacing: "-0.03em", marginBottom: 16, lineHeight: 1.2 }}>
              Ready to begin?
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.75, marginBottom: 40 }}>
              No commitment, no overwhelming onboarding. Just one calm check-in to see where you are today.
            </p>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <motion.button className="btn-cta" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}>
                Start your first check-in <ArrowRight size={16} style={{ display: "inline", verticalAlign: "middle" }} />
              </motion.button>
            </Link>
          </div>
        </FadeUp>
      </section>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1px solid var(--bg-border)", padding: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          {["Privacy","Terms","Security","Contact"].map(l => (
            <span key={l} style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, fontFamily: "IBM Plex Mono" }}>
          © 2026 Healthly · AI-assisted mental wellness · Built with care
        </div>
      </div>

    </div>
  );
}
