import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ClipboardList, Frown, Meh, Smile } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const RING_RADIUS = 56;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function useAnimatedCount(target) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let current = 0;
    const step = target > 0 ? Math.max(1, Math.round(target / 20)) : 1;
    const id = setInterval(() => {
      current += step;
      if (current >= target) {
        setValue(target);
        clearInterval(id);
        return;
      }
      setValue(current);
    }, 35);
    return () => clearInterval(id);
  }, [target]);

  return value;
}

function riskTone(riskLevel) {
  const value = (riskLevel || "").toLowerCase();
  if (value.includes("severe")) {
    return { cls: "card-risk-high", icon: AlertTriangle, label: "High" };
  }
  if (value.includes("moderate")) {
    return { cls: "card-risk-medium", icon: Meh, label: "Medium" };
  }
  return { cls: "card-risk-low", icon: Smile, label: "Low" };
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fallback = typeof window !== "undefined" ? localStorage.getItem("latest_result") : null;
  const parsedFallback = fallback ? JSON.parse(fallback) : null;
  const result = location.state?.result || parsedFallback;

  const score = result?.score || 0;
  const riskLevel = result?.risk_level || "Minimal";
  const recommendation = result?.recommended_action || "Keep tracking your wellbeing and maintain healthy routines.";
  const dominantEmotion = result?.dominant_emotion || "stable";
  const emotionConfidence = typeof result?.emotion_confidence === "number" ? Math.round(result.emotion_confidence * 100) : null;
  const secondaryEmotions = Array.isArray(result?.secondary_emotions) ? result.secondary_emotions : [];
  const concernAreas = Array.isArray(result?.concern_areas) ? result.concern_areas : [];
  const emotionSummary = result?.emotion_summary || "Emotion patterns were inferred from PHQ-9 symptom clusters.";
  const emotionRationale = result?.emotion_rationale || "No additional rationale available.";
  const needsHumanReview = Boolean(result?.needs_human_review);
  const riskFlags = Array.isArray(result?.risk_flags) ? result.risk_flags : [];
  const agentVersion = result?.agent_version || null;
  const mentalStateLabel = result?.mental_state_label || "stable";
  const mentalStateConfidence = typeof result?.mental_state_confidence === "number" ? Math.round(result.mental_state_confidence * 100) : null;

  const emotionalScore = typeof result?.emotional_score === "number" ? result.emotional_score : Math.min(score, 9);
  const cognitiveScore = typeof result?.cognitive_score === "number" ? result.cognitive_score : Math.max(0, Math.min(score - 3, 9));
  const physicalScore = typeof result?.physical_score === "number" ? result.physical_score : Math.max(0, Math.min(score - 6, 9));
  const functionalScore = typeof result?.functional_score === "number" ? result.functional_score : Math.max(0, Math.min(score - 8, 9));

  const animatedScore = useAnimatedCount(score);
  const ringOffset = useMemo(() => {
    const progress = Math.min(Math.max(score / 27, 0), 1);
    return RING_CIRCUMFERENCE * (1 - progress);
  }, [score]);

  const tone = riskTone(riskLevel);
  const ToneIcon = tone.icon;

  if (!result) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="card-glass text-center text-slate-800">
          <p className="text-xl font-semibold">No assessment result found</p>
          <button className="btn-primary mt-6" onClick={() => navigate("/assessment")}>Take Assessment</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-gradient">
        <p className="text-sm uppercase tracking-wider text-white/80">Your Wellbeing Score</p>
        <div className="mt-5 grid gap-8 md:grid-cols-[auto,1fr] md:items-center">
          <div className="relative h-36 w-36">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="12" />
              <circle
                cx="70"
                cy="70"
                r={RING_RADIUS}
                fill="none"
                stroke="white"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold">{animatedScore}</p>
              <p className="text-sm text-white/80">/ 27</p>
            </div>
          </div>
          <div>
            <p className="text-lg text-white/85">Your risk level: <span className="font-bold">{riskLevel.toUpperCase()}</span></p>
            <p className="mt-3 text-sm text-white/85">Based on your responses, this indicates your current emotional burden and support needs.</p>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card-glass text-slate-800">
          <p className="text-sm text-slate-500">Emotional</p>
          <p className="mt-2 text-xl font-semibold">{emotionalScore} / 9</p>
          <Frown className="mt-3 h-5 w-5 text-indigo-600" />
        </article>
        <article className="card-glass text-slate-800">
          <p className="text-sm text-slate-500">Cognitive</p>
          <p className="mt-2 text-xl font-semibold">{cognitiveScore} / 9</p>
          <ClipboardList className="mt-3 h-5 w-5 text-indigo-600" />
        </article>
        <article className="card-glass text-slate-800">
          <p className="text-sm text-slate-500">Physical</p>
          <p className="mt-2 text-xl font-semibold">{physicalScore} / 9</p>
          <Meh className="mt-3 h-5 w-5 text-indigo-600" />
        </article>
        <article className="card-glass text-slate-800">
          <p className="text-sm text-slate-500">Functional</p>
          <p className="mt-2 text-xl font-semibold">{functionalScore} / 9</p>
          <CheckCircle2 className="mt-3 h-5 w-5 text-indigo-600" />
        </article>
      </section>

      <section className="card-glass text-slate-800">
        <h2 className="text-xl font-semibold">AI Insights</h2>
        {needsHumanReview ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            This assessment has complex or safety-sensitive signals. A clinician or trusted support person review is recommended.
          </div>
        ) : null}
        <p className="mt-3 text-slate-600">{emotionSummary}</p>
        <p className="mt-2 text-sm text-slate-500">Dominant emotion: <span className="font-semibold capitalize text-slate-700">{dominantEmotion}</span>{emotionConfidence !== null ? ` (${emotionConfidence}% confidence)` : ""}</p>
        <p className="mt-2 text-sm text-slate-500">Mental state: <span className="font-semibold capitalize text-slate-700">{mentalStateLabel}</span>{mentalStateConfidence !== null ? ` (${mentalStateConfidence}% confidence)` : ""}</p>
        <p className="mt-2 text-sm text-slate-500">{emotionRationale}</p>
        {secondaryEmotions.length ? (
          <p className="mt-2 text-sm text-slate-500">
            Secondary signals: <span className="font-medium text-slate-700">{secondaryEmotions.join(", ")}</span>
          </p>
        ) : null}
        {concernAreas.length ? (
          <p className="mt-2 text-sm text-slate-500">
            Concern areas: <span className="font-medium text-slate-700">{concernAreas.join(", ")}</span>
          </p>
        ) : null}
        {riskFlags.length ? (
          <p className="mt-2 text-sm text-slate-500">
            Agent risk flags: <span className="font-medium text-slate-700">{riskFlags.join(", ")}</span>
          </p>
        ) : null}
        {agentVersion ? <p className="mt-2 text-xs text-slate-400">Model: {agentVersion}</p> : null}
      </section>

      <section className="card-glass text-slate-800">
        <div className={`rounded-xl p-4 ${tone.cls}`}>
          <div className="flex items-center gap-2">
            <ToneIcon className="h-5 w-5" />
            <p className="font-semibold">Current Risk: {tone.label}</p>
          </div>
        </div>
        <h3 className="mt-5 text-lg font-semibold">Recommended Actions</h3>
        <ul className="mt-3 list-inside list-disc space-y-1 text-slate-600">
          <li>Try guided breathing or meditation for 10-15 minutes.</li>
          <li>Check in with a counselor or trusted support person.</li>
          <li>Continue tracking your wellbeing every week.</li>
          <li>{recommendation}</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" onClick={() => navigate("/dashboard")}>Go to Dashboard</button>
        <button className="btn-secondary" onClick={() => navigate("/chat")}>Talk to AI Support</button>
      </div>
    </main>
  );
}
