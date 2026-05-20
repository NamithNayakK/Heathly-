import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, Key, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { api } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { email: "", password: "", full_name: "" } });

  const onSubmit = async (form) => {
    setError(""); setLoading(true);
    try {
      const payload = isRegister ? await api.register(form) : await api.login({ email: form.email, password: form.password });
      localStorage.setItem("token", payload.access_token);
      localStorage.setItem("user_id", payload.user_id || "");
      localStorage.setItem("email", payload.user_email || payload.email || "");
      localStorage.setItem("full_name", payload.full_name || "");
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 0, width: '100%', maxWidth: 900, boxShadow: '0 25px 80px rgba(0,0,0,0.5)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--bg-border)' }}>

        {/* Left Info Panel */}
        <div style={{ background: 'var(--bg-surface)', padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, var(--cyan), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>H</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>HEALTHLY</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Clinical AI Platform</div>
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 12 }}>
              Enterprise Mental Health Intelligence
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              Multimodal diagnostic AI combining PHQ-9 analysis, BioClinicalBERT record parsing, wearable sensor telemetry, and conversational NLP into a unified clinical intelligence platform.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: Activity, label: 'Real-time multimodal fusion', color: 'var(--cyan)' },
              { icon: ShieldCheck, label: 'HIPAA-aligned data handling', color: 'var(--emerald)' },
              { icon: Lock, label: 'Enterprise-grade security', color: 'var(--violet)' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 13, height: 13, color }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', paddingTop: 16, borderTop: '1px solid var(--bg-border)' }}>
            v2.0.0 · DistilBERT · XGBoost · BioClinicalBERT · Attention Fusion
          </div>
        </div>

        {/* Right Form Panel */}
        <div style={{ background: 'var(--bg-elevated)', padding: '48px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {isRegister ? 'Create account' : 'Sign in'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isRegister ? 'Register your clinical workspace' : 'Access your clinical intelligence dashboard'}
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertTriangle style={{ width: 13, height: 13 }} />
              <span>{error}</span>
            </div>
          )}

          <motion.form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isRegister && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                  <input className="input-field" style={{ paddingLeft: 38 }} placeholder="Jane Smith" {...register("full_name", { required: isRegister })} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                <input className="input-field" style={{ paddingLeft: 38 }} type="email" placeholder="you@organization.com" {...register("email", { required: true })} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Key style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                <input className="input-field" style={{ paddingLeft: 38 }} type="password" placeholder="Min. 8 characters" {...register("password", { required: true, minLength: 8 })} />
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </motion.form>

          <div style={{ textAlign: 'center', borderTop: '1px solid var(--bg-border)', paddingTop: 16 }}>
            <button
              onClick={() => { setIsRegister(v => !v); setError(""); reset(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--cyan)', fontWeight: 500 }}
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'IBM Plex Mono' }}>
            256-bit TLS encryption · Clinical data protection
          </div>
        </div>
      </div>
    </div>
  );
}
