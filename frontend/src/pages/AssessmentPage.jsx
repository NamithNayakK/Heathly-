import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, ClipboardList, Zap, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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

const LABELS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
const SCORE_COLORS = ['var(--emerald)', 'var(--cyan)', 'var(--amber)', 'var(--rose)'];

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(Array(9).fill(null));
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm();

  const answered = useMemo(() => answers.filter(a => a !== null).length, [answers]);
  const progress = ((current + 1) / QUESTIONS.length) * 100;
  const isLast = current === QUESTIONS.length - 1;

  const update = (idx, val) => {
    const next = [...answers];
    next[idx] = Number(val);
    setAnswers(next);
    setValue(`q_${idx}`, Number(val));
  };

  const submit = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const data = await api.submitPHQ9(answers);
      localStorage.setItem("latest_result", JSON.stringify(data));
      navigate("/results", { state: { result: data } });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live risk preview based on answers so far
  const currentTotal = answers.filter(a => a !== null).reduce((s, a) => s + a, 0);
  const projectedRisk = currentTotal <= 4 ? 'Minimal' : currentTotal <= 9 ? 'Mild' : currentTotal <= 14 ? 'Moderate' : 'Severe';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div>
        <div className="page-title">AI Clinical Assessment</div>
        <div className="page-subtitle">PHQ-9 Depression Screening · DSM-V Aligned · DistilBERT + XGBoost Analysis</div>
      </div>

      {/* Progress timeline */}
      <div className="card card-sm">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
            QUESTION {current + 1} OF {QUESTIONS.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>ANSWERED: {answered}/9</span>
            <span className={`badge ${
              projectedRisk === 'Severe' ? 'badge-rose' :
              projectedRisk === 'Moderate' ? 'badge-amber' :
              projectedRisk === 'Mild' ? 'badge-cyan' : 'badge-live'
            }`}>
              Projected: {projectedRisk}
            </span>
          </div>
        </div>
        <div className="meter-bar">
          <div className="meter-fill" style={{ width: `${progress}%` }} />
        </div>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {QUESTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: answers[i] !== null ? 20 : 12,
                height: 4,
                borderRadius: 2,
                background: i === current ? 'var(--cyan)' : answers[i] !== null ? 'var(--emerald)' : 'rgba(255,255,255,0.08)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
        {/* Question Card */}
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22 }}
          className="card"
        >
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>
              SYMPTOM DOMAIN {current + 1}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {QUESTIONS[current]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Rate based on the past 2 weeks
            </div>
          </div>

          <form onSubmit={handleSubmit(submit)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map((score) => {
              const selected = answers[current] === score;
              return (
                <label key={score} className={`radio-option ${selected ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    style={{ display: 'none' }}
                    {...register(`q_${current}`)}
                    checked={answers[current] === score}
                    onChange={() => update(current, score)}
                  />
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? SCORE_COLORS[score] : 'rgba(255,255,255,0.15)'}`,
                    background: selected ? `${SCORE_COLORS[score]}30` : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}>
                    {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: SCORE_COLORS[score] }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {LABELS[score]}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 1 }}>
                      Score: {score}
                    </div>
                  </div>
                </label>
              );
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--bg-border)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={current === 0}
                onClick={() => setCurrent(v => v - 1)}
              >
                <ArrowLeft style={{ width: 13, height: 13 }} /> Previous
              </button>
              {!isLast ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={answers[current] === null}
                  onClick={() => setCurrent(v => v + 1)}
                  style={{ marginLeft: 'auto' }}
                >
                  Next <ArrowRight style={{ width: 13, height: 13 }} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={answered !== 9 || isSubmitting}
                  style={{ marginLeft: 'auto' }}
                >
                  {isSubmitting ? 'Analyzing...' : 'Submit & Analyze'}
                  <Zap style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>
          </form>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              <span>{error}</span>
            </div>
          )}
        </motion.div>

        {/* Side Panel: AI Interpretation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-sm">
            <div className="section-title">AI Interpretation</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Brain style={{ width: 14, height: 14, color: 'var(--violet)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Live assessment preview</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Score</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{currentTotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Projected Risk</span>
                <span className={`badge ${
                  projectedRisk === 'Severe' ? 'badge-rose' :
                  projectedRisk === 'Moderate' ? 'badge-amber' :
                  projectedRisk === 'Mild' ? 'badge-cyan' : 'badge-live'
                }`}>{projectedRisk}</span>
              </div>
              <div className="meter-bar" style={{ marginTop: 4 }}>
                <div
                  className={`meter-fill ${
                    projectedRisk === 'Severe' ? 'rose' :
                    projectedRisk === 'Moderate' ? 'amber' : ''
                  }`}
                  style={{ width: `${Math.min((currentTotal / 27) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="card card-sm">
            <div className="section-title">Assessment Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              {[
                ['Instrument', 'PHQ-9'],
                ['Framework', 'DSM-V'],
                ['Classifier', 'DistilBERT'],
                ['Risk Model', 'XGBoost'],
                ['Timeframe', 'Last 14 days'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{k}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-sm" style={{ background: 'var(--amber-dim)', borderColor: 'rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: 11, color: '#FCD34D', fontFamily: 'IBM Plex Mono', marginBottom: 6 }}>NOTE</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This tool is not a substitute for professional clinical evaluation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
