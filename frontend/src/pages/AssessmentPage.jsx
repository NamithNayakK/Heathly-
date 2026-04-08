import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(Array(9).fill(null));
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm();

  const currentValue = watch(`q_${currentQuestion}`);
  const answeredCount = useMemo(() => answers.filter((item) => item !== null).length, [answers]);
  const progressWidth = Math.round(((currentQuestion + 1) / QUESTIONS.length) * 100);
  const isLast = currentQuestion === QUESTIONS.length - 1;

  const updateAnswer = (index, value) => {
    const updated = [...answers];
    updated[index] = Number(value);
    setAnswers(updated);
    setValue(`q_${index}`, Number(value));
  };

  const submit = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const data = await api.submitPHQ9(answers);
      localStorage.setItem("latest_result", JSON.stringify(data));
      navigate("/results", { state: { result: data } });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((v) => v + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((v) => v - 1);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <section className="card-glass text-slate-800">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
          <span>Progress</span>
          <span>
            {currentQuestion + 1}/{QUESTIONS.length}
          </span>
        </div>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progressWidth}%` }} />
        </div>
      </section>

      <motion.section
        key={currentQuestion}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card-glass text-slate-800"
      >
        <h1 className="text-2xl font-bold">PHQ-9 Assessment</h1>
        <p className="mt-1 text-sm text-slate-500">Please answer based on the last 2 weeks.</p>

        <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4">
          <p className="text-lg font-semibold">
            Q{currentQuestion + 1}: {QUESTIONS[currentQuestion]}
          </p>

          {[0, 1, 2, 3].map((score) => {
            const labels = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
            const selected = Number(currentValue) === score;
            return (
              <label
                key={score}
                className={`radio-option ${selected ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  {...register(`q_${currentQuestion}`)}
                  checked={answers[currentQuestion] === score}
                  onChange={() => updateAnswer(currentQuestion, score)}
                />
                <span className="font-semibold">{score}</span>
                <span className="text-slate-600">{labels[score]}</span>
              </label>
            );
          })}

          <div className="flex flex-wrap justify-between gap-3 pt-3">
            <button
                className="btn-secondary btn-ripple focus-ring inline-flex items-center gap-2"
              disabled={currentQuestion === 0}
              onClick={previousQuestion}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>

            {!isLast ? (
              <button
                className="btn-primary btn-ripple focus-ring inline-flex items-center gap-2"
                disabled={answers[currentQuestion] === null}
                onClick={nextQuestion}
                type="button"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button className="btn-primary btn-ripple focus-ring" disabled={answeredCount !== 9 || isSubmitting} type="submit">
                {isSubmitting ? "Submitting..." : "View Results"}
              </button>
            )}
          </div>
        </form>

        <p className="mt-4 text-xs text-slate-500">Answered: {answeredCount} / 9</p>
      </motion.section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </main>
  );
}
