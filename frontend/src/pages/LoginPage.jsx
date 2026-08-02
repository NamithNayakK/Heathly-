import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowRight, Eye, EyeOff,
  Key, Lock, Mail, ShieldCheck, Stethoscope, User, UserCog, CheckCircle, XCircle, FileText, Building
} from "lucide-react";
import { api } from "../lib/api";

const ROLE_OPTIONS = [
  {
    value: "patient",
    label: "Patient",
    icon: User,
    color: "var(--teal)",
    glow: "rgba(94,234,212,0.20)",
    description: "Access your wellness dashboard, assessments & AI companion",
  },
  {
    value: "consultant",
    label: "Consultant",
    icon: Stethoscope,
    color: "var(--emerald)",
    glow: "rgba(16,185,129,0.20)",
    description: "Manage patients, view sensor data, and write clinical notes",
  },
  {
    value: "admin",
    label: "Admin",
    icon: UserCog,
    color: "var(--lav)",
    glow: "rgba(167,139,250,0.20)",
    description: "Platform oversight, user management, and system analytics",
  },
];

const FEATURES = [
  { icon: Activity,    label: "Real-time multimodal AI fusion",   color: "var(--teal)" },
  { icon: ShieldCheck, label: "HIPAA-aligned data handling",       color: "var(--teal)" },
  { icon: Lock,        label: "End-to-end encrypted sessions",     color: "var(--lav)" },
];

/* Floating background orbs */
function BgOrbs() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.18, 0.28, 0.18] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "-10%", left: "-15%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(94,234,212,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.12, 0.22, 0.12] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        style={{
          position: "absolute", bottom: "-15%", right: "-10%",
          width: 420, height: 420, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.20) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
    </div>
  );
}

/* Input field with icon */
function FormField({ label, icon: Icon, type = "text", placeholder, registration, error }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword && showPw ? "text" : type;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <Icon size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          className="input-field"
          type={actualType}
          placeholder={placeholder}
          {...registration}
          style={{ paddingLeft: 40, paddingRight: isPassword ? 40 : 14 }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: 11, color: "var(--amber)", fontFamily: "IBM Plex Mono" }}>{error}</span>}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [selectedRole, setSelectedRole] = useState("patient");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { email: "", password: "", full_name: "", registration_number: "", registration_body: "" },
  });

  const onSubmit = async (form) => {
    setError(""); setLoading(true);
    try {
      const payload = isRegister
        ? await api.register({ ...form, role: selectedRole })
        : await api.login({ email: form.email, password: form.password });
      sessionStorage.setItem("token",     payload.access_token);
      sessionStorage.setItem("user_id",   payload.user_id   || "");
      sessionStorage.setItem("email",     payload.user_email || payload.email || "");
      sessionStorage.setItem("full_name", payload.full_name  || "");
      sessionStorage.setItem("role",      payload.role       || "patient");

      localStorage.setItem("token",     payload.access_token);
      localStorage.setItem("user_id",   payload.user_id   || "");
      localStorage.setItem("email",     payload.user_email || payload.email || "");
      localStorage.setItem("full_name", payload.full_name  || "");
      localStorage.setItem("role",      payload.role       || "patient");

      if (isRegister && selectedRole === "consultant") {
        setVerificationResult({
          status: payload.verification_status,
          reason: payload.verification_reason
        });
      } else {
        navigate("/dashboard");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(v => !v);
    setError(""); reset(); setSelectedRole("patient"); setVerificationResult(null);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-base)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative", overflow: "hidden",
    }}>
      <BgOrbs />

      {/* Back to landing */}
      <Link to="/" style={{
        position: "fixed", top: 20, left: 24, textDecoration: "none",
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, color: "var(--text-muted)",
        padding: "6px 12px", borderRadius: 8,
        background: "rgba(255,255,255,0.04)", border: "1px solid var(--bg-border)",
        transition: "all 0.3s ease", zIndex: 10,
      }}>
        ← Healthly
      </Link>

      <div style={{
        position: "relative", zIndex: 1,
        display: "grid", gridTemplateColumns: "1fr 440px",
        width: "100%", maxWidth: 940,
        borderRadius: 24, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(94,234,212,0.05)",
      }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
          padding: "52px 44px",
          display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Subtle inner glow */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg, transparent, var(--teal), var(--lav), transparent)",
            opacity: 0.4,
          }} />

          {/* Logo */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
              <motion.div
                animate={{ boxShadow: ["0 0 0 0 rgba(94,234,212,0)", "0 0 16px rgba(94,234,212,0.4)", "0 0 0 0 rgba(94,234,212,0)"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: "linear-gradient(135deg, var(--teal-dark), var(--lav))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, color: "#fff",
                }}
              >
                H
              </motion.div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.07em" }}>HEALTHLY</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>Mental Wellness Platform</div>
              </div>
            </div>

            <h1 style={{
              fontFamily: "Fraunces, Georgia, serif",
              fontSize: "clamp(1.6rem, 2.5vw, 2.1rem)",
              fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.03em",
              color: "var(--text-primary)", marginBottom: 16,
            }}>
              Your mind has patterns.{" "}
              <span style={{
                background: "linear-gradient(135deg, var(--teal), var(--lav))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                We help you see them.
              </span>
            </h1>

            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 340 }}>
              Multimodal AI that fuses PHQ-9 data, wearable sensors, clinical records, and conversation analysis into one calm, continuous picture of your wellbeing.
            </p>
          </div>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {FEATURES.map(({ icon: Icon, label, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${color}15`, border: `1px solid ${color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
              </motion.div>
            ))}
          </div>

          {/* Footer note */}
          <div style={{
            fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono",
            paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)",
          }}>
            v2.0.0 · DistilBERT · XGBoost · BioClinicalBERT · Attention Fusion
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div style={{
          background: "var(--bg-elevated)",
          padding: "48px 40px",
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 24,
        }}>
          <AnimatePresence mode="wait">
            {verificationResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
              >
                {verificationResult.status === "approved" ? (
                  <CheckCircle size={48} style={{ color: "var(--emerald)" }} />
                ) : (
                  <XCircle size={48} style={{ color: "var(--rose)" }} />
                )}
                
                <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 24, margin: 0, color: "var(--text-primary)" }}>
                  {verificationResult.status === "approved" 
                    ? "Verified — you now have consultant access" 
                    : "Verification failed"}
                </h2>
                
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {verificationResult.status === "approved"
                    ? "Your registration number and name matched the public medical registry successfully. You can now access patient data."
                    : `Reason: ${verificationResult.reason}. You have been registered, but your consultant access is pending manual admin review.`}
                </p>
                
                <button
                  onClick={() => navigate("/dashboard")}
                  className="btn-cta"
                  style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
                >
                  Continue to Dashboard <ArrowRight size={15} style={{ marginLeft: 8 }} />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={isRegister ? "reg" : "login"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ width: "100%" }}
              >
                <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>
                  {isRegister ? "Create your account" : "Welcome back"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {isRegister ? "Join Healthly to start your first check-in" : "Sign in to continue your wellness journey"}
                </div>

                {/* Error alert */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="alert alert-warn"
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4 }}
                      style={{ marginTop: 24 }}
                    >
                      <AlertTriangle size={13} />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>

            <AnimatePresence>
              {isRegister && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}
                >
                  {/* Full name */}
                  <FormField
                    label="Full Name"
                    icon={User}
                    placeholder="Your name"
                    registration={register("full_name", { required: isRegister })}
                    error={errors.full_name && "Name is required"}
                  />

                  {/* Role selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      I am a…
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {ROLE_OPTIONS.map((role) => {
                        const Icon = role.icon;
                        const sel = selectedRole === role.value;
                        return (
                          <motion.button
                            key={role.value}
                            type="button"
                            onClick={() => setSelectedRole(role.value)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                              padding: "14px 8px", borderRadius: 12, cursor: "pointer",
                              background: sel ? `${role.color}12` : "rgba(255,255,255,0.03)",
                              border: `1.5px solid ${sel ? role.color : "rgba(255,255,255,0.07)"}`,
                              boxShadow: sel ? `0 0 20px ${role.glow}` : "none",
                              transition: "border-color 0.5s ease, background 0.5s ease, box-shadow 0.5s ease",
                            }}
                          >
                            <div style={{
                              width: 34, height: 34, borderRadius: 9,
                              background: sel ? `${role.color}20` : "rgba(255,255,255,0.05)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.5s ease",
                            }}>
                              <Icon size={16} style={{ color: sel ? role.color : "var(--text-muted)" }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: sel ? role.color : "var(--text-secondary)", transition: "color 0.4s ease" }}>
                              {role.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                    {/* Role description */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedRole}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          fontSize: 11, color: "var(--text-muted)", textAlign: "center",
                          padding: "8px 12px", borderRadius: 8,
                          background: "rgba(255,255,255,0.025)",
                          border: "1px solid rgba(255,255,255,0.04)",
                          lineHeight: 1.6,
                        }}
                      >
                        {ROLE_OPTIONS.find(r => r.value === selectedRole)?.description}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  
                  {/* Consultant Specific Fields */}
                  <AnimatePresence>
                    {selectedRole === "consultant" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden", marginTop: 8 }}
                      >
                        <div style={{
                          fontSize: 11, color: "var(--amber)", background: "rgba(245,158,11,0.05)",
                          padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)",
                          lineHeight: 1.5, display: "flex", gap: 8, alignItems: "center"
                        }}>
                          <ShieldCheck size={16} />
                          <span>We use an automated registry lookup to instantly verify your consultant credentials.</span>
                        </div>
                        
                        <FormField
                          label="Registration Number"
                          icon={FileText}
                          placeholder="e.g. KMC10001"
                          registration={register("registration_number", { required: selectedRole === "consultant" })}
                          error={errors.registration_number && "Registration number is required"}
                        />
                        <FormField
                          label="Registration Body"
                          icon={Building}
                          placeholder="e.g. Karnataka Medical Council"
                          registration={register("registration_body", { required: selectedRole === "consultant" })}
                          error={errors.registration_body && "Registration body is required"}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <FormField
              label="Email"
              icon={Mail}
              type="email"
              placeholder="you@example.com"
              registration={register("email", { required: true })}
              error={errors.email && "Email is required"}
            />

            {/* Password */}
            <FormField
              label="Password"
              icon={Key}
              type="password"
              placeholder={isRegister ? "Min. 8 characters" : "Your password"}
              registration={register("password", { required: true, minLength: 8 })}
              error={errors.password && "Password must be at least 8 characters"}
            />

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              className="btn-cta"
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: "100%", justifyContent: "center", marginTop: 4, display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ display: "block", width: 14, height: 14, border: "2px solid #0B1120", borderTopColor: "transparent", borderRadius: "50%" }}
                  />
                  {isRegister ? "Creating account…" : "Signing in…"}
                </span>
              ) : (
                <>
                  {isRegister ? "Create account" : "Sign in"}
                  <ArrowRight size={15} />
                </>
              )}
            </motion.button>
          </form>

          {/* Toggle mode */}
          <div style={{ textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
            <button
              onClick={switchMode}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, color: "var(--teal)", fontWeight: 500,
                transition: "color 0.3s ease",
              }}
            >
              {isRegister
                ? "Already have an account? Sign in →"
                : "Don't have an account? Create one →"}
            </button>
          </div>
          </motion.div>
          )}
          </AnimatePresence>

          {/* Trust badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ShieldCheck size={12} style={{ color: "var(--teal)" }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono" }}>
              256-bit TLS · Clinical data protection · Zero third-party analytics
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
