import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Zap, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking slowly, or being very restless",
  "Thoughts that you would be better off dead, or of hurting yourself",
];

const LABELS = [
  { label: "Not at all",            sub: "0 days in the past 2 weeks" },
  { label: "Several days",          sub: "1–6 days" },
  { label: "More than half the days", sub: "7–11 days" },
  { label: "Nearly every day",      sub: "12–14 days" },
];

// Calm, non-judgmental — all teal/lavender, no red in the input flow
const OPTION_COLORS = ["var(--teal)", "var(--teal)", "var(--lav)", "var(--lav)"];

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(Array(9).fill(null));
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answered = useMemo(() => answers.filter(a => a !== null).length, [answers]);
  const progress  = (current / (QUESTIONS.length - 1)) * 100;
  const isLast    = current === QUESTIONS.length - 1;

  const goTo = (next) => {
    setDir(next > current ? 1 : -1);
    setCurrent(next);
  };

  const update = (val) => {
    const next = [...answers];
    next[current] = val;
    setAnswers(next);
  };

  const submit = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const data = await api.submitPHQ9(answers);
      sessionStorage.setItem("latest_result", JSON.stringify(data));
      localStorage.setItem("latest_result", JSON.stringify(data));
      navigate("/results", { state: { result: data } });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div>
        <div className="page-title">PHQ-9 Assessment</div>
        <div className="page-subtitle">One question at a time · DSM-V aligned · Takes ~3 minutes</div>
      </div>

      {/* Breathing progress line */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "IBM Plex Mono" }}>
          <span style={{ color: "var(--text-muted)" }}>Question {current + 1} of {QUESTIONS.length}</span>
          <span style={{ color: "var(--text-muted)" }}>{answered} answered</span>
        </div>
        <div className="breath-line">
          <motion.div
            className="breath-line-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        {/* Step dots */}
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {QUESTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? 24 : 8, height: 8, borderRadius: 4,
                background: i === current ? "var(--teal)" : answers[i] !== null ? "var(--teal-dark)" : "rgba(255,255,255,0.07)",
                border: "none", cursor: "pointer",
                transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
                opacity: i === current ? 1 : 0.7,
              }}
            />
          ))}
        </div>
      </div>

      {/* Question card with AnimatePresence */}
      <div style={{ position: "relative" }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={current}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bento-card" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Question text */}
              <div>
                <div style={{ fontSize: 10, color: "var(--teal)", fontFamily: "IBM Plex Mono", letterSpacing: "0.1em", marginBottom: 12 }}>
                  QUESTION {current + 1} · PAST 2 WEEKS
                </div>
                <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(1.1rem,2vw,1.4rem)", fontWeight: 600, lineHeight: 1.45, color: "var(--text-primary)" }}>
                  {QUESTIONS[current]}
                </div>
              </div>

              {/* Answer options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {LABELS.map(({ label, sub }, score) => {
                  const selected = answers[current] === score;
                  const color = OPTION_COLORS[score];
                  return (
                    <motion.button
                      key={score}
                      onClick={() => update(score)}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className={`answer-option ${selected ? "selected" : ""}`}
                    >
                      {/* Custom radio circle */}
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${selected ? color : "rgba(255,255,255,0.15)"}`,
                        background: selected ? `${color}25` : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
                      }}>
                        {selected && (
                          <motion.div
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            style={{ width: 8, height: 8, borderRadius: "50%", background: color }}
                          />
                        )}
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 14, fontWeight: selected ? 600 : 400, color: selected ? "var(--text-primary)" : "var(--text-secondary)", transition: "color 0.5s ease" }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
                      </div>
                      {selected && <CheckCircle2 size={16} style={{ color, flexShrink: 0 }} />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid var(--bg-border)" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={current === 0}
                  onClick={() => goTo(current - 1)}
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <div style={{ flex: 1 }} />
                {!isLast ? (
                  <motion.button
                    className="btn btn-primary btn-sm"
                    disabled={answers[current] === null}
                    onClick={() => goTo(current + 1)}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    Continue <ArrowRight size={13} />
                  </motion.button>
                ) : (
                  <motion.button
                    className="btn btn-primary btn-sm"
                    disabled={answered !== 9 || isSubmitting}
                    onClick={submit}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {isSubmitting ? "Analyzing..." : "Submit & Analyze"} <Zap size={13} />
                  </motion.button>
                )}
              </div>

              {error && (
                <div className="alert alert-warn">
                  <AlertTriangle size={13} /> <span>{error}</span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Reassurance note */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.7 }}
      >
        Your responses are private and encrypted. This assessment does not replace professional clinical evaluation.
      </motion.div>

    </div>
  );
}
