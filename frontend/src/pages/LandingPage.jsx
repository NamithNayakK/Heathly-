import { Link } from "react-router-dom";
import { Activity, ArrowRight, Brain, CheckCircle2, ChevronRight, Cpu, FileText, MessageSquare, Shield, Zap } from "lucide-react";

const CAPABILITIES = [
  { icon: Brain, label: 'DistilBERT Emotion Analysis', sub: 'Real-time linguistic sentiment parsing', color: 'var(--violet)' },
  { icon: FileText, label: 'BioClinicalBERT Record Parsing', sub: 'Medical entity extraction at clinical scale', color: 'var(--cyan)' },
  { icon: Activity, label: 'Wearable Sensor Fusion', sub: 'BiLSTM-based physiological telemetry', color: 'var(--emerald)' },
  { icon: Cpu, label: 'Attention Fusion Engine', sub: 'Multimodal risk synthesis across 4 streams', color: 'var(--blue)' },
  { icon: MessageSquare, label: 'CBT AI Companion', sub: 'Conversational therapy with NLP feedback', color: 'var(--violet)' },
  { icon: Shield, label: 'Bias & Fairness Monitoring', sub: 'Clinical AI governance and audit layer', color: 'var(--emerald)' },
];

const METRICS = [
  { value: '94.2%', label: 'Diagnostic Accuracy' },
  { value: '<12ms', label: 'Response Latency' },
  { value: '4', label: 'Modalities Integrated' },
  { value: 'HIPAA', label: 'Compliance Standard' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Inter, IBM Plex Sans, sans-serif' }}>
      
      {/* Top Nav */}
      <nav style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, var(--cyan), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>H</div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em' }}>HEALTHLY</div>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--cyan-dim)', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em' }}>BETA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/login" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 12px', borderRadius: 6, transition: 'color 0.15s' }}>Sign in</Link>
            <Link to="/login" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              Get started <ArrowRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px 64px' }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 64px', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
          <div className="landing-hero-badge">
            <Cpu style={{ width: 11, height: 11 }} />
            Enterprise Clinical AI Platform · v2.0
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', margin: 0 }}>
            Mental Health Intelligence<br />
            <span style={{ background: 'linear-gradient(135deg, var(--cyan), var(--blue))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              at Clinical Scale
            </span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 560, margin: 0 }}>
            Multimodal AI diagnostic platform integrating PHQ-9 analysis, BioClinicalBERT record parsing, wearable telemetry, and conversational NLP into a unified clinical intelligence layer.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none', padding: '10px 24px', fontSize: 14 }}>
              Launch Platform <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
            <a href="#capabilities" className="btn btn-secondary" style={{ textDecoration: 'none', padding: '10px 24px', fontSize: 14 }}>
              View Capabilities
            </a>
          </div>
        </div>

        {/* Metric Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--bg-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 64 }}>
          {METRICS.map(({ value, label }) => (
            <div key={label} style={{ background: 'var(--bg-surface)', padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Capabilities */}
        <div id="capabilities" style={{ marginBottom: 64 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Platform Capabilities</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>End-to-end clinical AI stack</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {CAPABILITIES.map(({ icon: Icon, label, sub, color }) => (
              <div key={label} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 15, height: 15, color }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Footer */}
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Ready to deploy clinical AI?</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 440 }}>
            Join the next generation of healthcare intelligence systems. Production-ready, cloud-deployable, enterprise-grade.
          </div>
          <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none', padding: '10px 28px', fontSize: 14 }}>
            Get Access <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--bg-border)', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
          HEALTHLY Clinical AI · Enterprise Platform · Built for modern healthcare intelligence
        </div>
      </div>
    </div>
  );
}
