import React, { useEffect, useState } from 'react';
import { Sparkles, Heart, BookOpen, Check, Feather, Trash2, Calendar, Clock } from 'lucide-react';
import { api } from '../lib/api';

const MOOD_TYPES = [
  { label: 'Grounded', emoji: '🌿', val: 5, color: '#8B9A8B', desc: 'Feeling balanced & present' },
  { label: 'Warm & Hopeful', emoji: '☀️', val: 4, color: '#D4A574', desc: 'Light, steady energy' },
  { label: 'Reflective', emoji: '☁️', val: 3, color: '#E8DCC0', desc: 'Processing thoughts quietly' },
  { label: 'Tired / Heavy', emoji: '🌧️', val: 2, color: '#A0785A', desc: 'Carrying extra weight today' },
  { label: 'Overwhelmed', emoji: '🌊', val: 1, color: '#8B9A8B', desc: 'Seeking extra space and rest' },
];

export default function MoodLogPage() {
  const [selectedMood, setSelectedMood] = useState(MOOD_TYPES[1]);
  const [intensity, setIntensity] = useState(65);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  // Dynamic wave color interpolation between terracotta (#D4A574) and sage (#8B9A8B)
  const waveColor = selectedMood.val >= 3 ? '#D4A574' : '#8B9A8B';

  const loadHistory = async () => {
    try {
      const data = await api.getMoodLogs();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch mood logs:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.submitMoodLog({
        mood_label: selectedMood.label,
        emoji: selectedMood.emoji,
        val: selectedMood.val,
        intensity: Number(intensity),
        note: note.trim() || null,
      });

      setSaved(true);
      setNote('');
      await loadHistory();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save mood log entry.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteMoodLog(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 font-body">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#D4A574] text-xs font-mono tracking-wider uppercase mb-1">
            <Feather size={14} />
            <span>Private Journaling</span>
          </div>
          <h1 className="text-3xl font-display font-medium text-[#F5F0EB] tracking-tight">
            How are you holding up today?
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">
            A safe space to pause, reflect, and capture what you've noticed without diagnostic labels.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[rgba(212,165,116,0.1)] border border-[rgba(212,165,116,0.2)] px-3 py-1.5 rounded-full text-xs text-[#D4A574]">
          <Heart size={13} className="fill-[#D4A574]" />
          <span>Encrypted & Confidential</span>
        </div>
      </div>

      {/* Signature Interactive Wave Animation */}
      <div className="card relative overflow-hidden bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{selectedMood.emoji}</span>
            <span className="font-display text-lg text-[#F5F0EB] font-medium">{selectedMood.label}</span>
          </div>
          <span className="text-xs font-mono text-[#94A3B8] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 rounded-md">
            Intensity: {intensity}%
          </span>
        </div>

        {/* Dynamic Animated Wave Visualizer */}
        <div className="wave-container my-4 rounded-xl border border-[rgba(255,255,255,0.05)] relative overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path
              className="wave-path"
              d="M0,40 C150,90 350,-10 500,40 C650,90 850,10 1000,50 C1150,90 1250,20 1400,60 L1400,120 L0,120 Z"
              fill={waveColor}
              fillOpacity={0.25}
            />
            <path
              className="wave-path"
              style={{ animationDuration: '12s', animationDirection: 'reverse' }}
              d="M0,60 C200,10 400,80 600,30 C800,90 1000,20 1200,70 L1200,120 L0,120 Z"
              fill={waveColor}
              fillOpacity={0.4}
            />
          </svg>
        </div>

        <p className="text-xs text-[#94A3B8] italic text-center">
          Visualizing your emotional rhythm — terracotta highlights positive warmth, transitioning toward soft sage for deeper reflection.
        </p>
      </div>

      {/* Mood Selectors Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {MOOD_TYPES.map((mood) => {
          const isSelected = selectedMood.label === mood.label;
          return (
            <button
              key={mood.label}
              type="button"
              onClick={() => setSelectedMood(mood)}
              className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between h-32 ${
                isSelected
                  ? 'border-[#D4A574] bg-[rgba(212,165,116,0.12)] shadow-md translate-y-[-2px]'
                  : 'border-[rgba(255,255,255,0.06)] bg-[#161B26] hover:border-[rgba(255,255,255,0.12)]'
              }`}
            >
              <div className="text-2xl">{mood.emoji}</div>
              <div>
                <div className="font-medium text-sm text-[#F5F0EB]">{mood.label}</div>
                <div className="text-[11px] text-[#94A3B8] leading-tight mt-1">{mood.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Reflection Input Form */}
      <form onSubmit={handleSave} className="card bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-6">
        {error && (
          <div className="p-3 bg-[rgba(244,63,94,0.12)] border border-[rgba(244,63,94,0.3)] rounded-xl text-xs text-[#F43F5E]">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#F5F0EB] mb-2">
            What's lingering on your mind? <span className="text-[#94A3B8] font-normal">(Optional reflection)</span>
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write down any notes, thoughts about your day, or small moments you noticed..."
            className="w-full bg-[#161B26] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 text-sm text-[#F5F0EB] focus:outline-none focus:border-[#D4A574] transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#F5F0EB] mb-2">
            Energy & Awareness Slider
          </label>
          <input
            type="range"
            min="10"
            max="100"
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full accent-[#D4A574] cursor-pointer"
          />
          <div className="flex justify-between text-xs text-[#94A3B8] mt-1 font-mono">
            <span>Gentle / Quiet</span>
            <span>Balanced</span>
            <span>High Vibrancy</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[#94A3B8] flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#D4A574]" />
            Your entry stays private to you.
          </span>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-[#D4A574] to-[#A0785A] text-[#0B1120] hover:brightness-110 transition flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check size={16} /> Saved to Database!
              </>
            ) : loading ? (
              <span>Saving...</span>
            ) : (
              <>
                <BookOpen size={16} /> Save Check-In Entry
              </>
            )}
          </button>
        </div>
      </form>

      {/* Past Entries Journal History */}
      <div className="space-y-4">
        <h2 className="text-xl font-display font-medium text-[#F5F0EB] flex items-center gap-2">
          <Calendar size={18} className="text-[#D4A574]" />
          <span>Your Reflection History</span>
          <span className="text-xs font-mono text-[#94A3B8] font-normal">({history.length} entries)</span>
        </h2>

        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="card bg-[#161B26] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-[rgba(255,255,255,0.12)]"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl p-2 bg-[#111827] rounded-lg border border-[rgba(255,255,255,0.05)]">
                    {entry.emoji}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[#F5F0EB]">{entry.mood_label}</span>
                      <span className="text-[11px] font-mono text-[#D4A574] bg-[rgba(212,165,116,0.1)] px-2 py-0.5 rounded">
                        Intensity: {entry.intensity}%
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed bg-[#111827] p-2.5 rounded-lg border border-[rgba(255,255,255,0.04)]">
                        "{entry.note}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-[rgba(255,255,255,0.04)] pt-2 sm:pt-0">
                  <span className="text-[11px] font-mono text-[#64748B] flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="p-1.5 text-[#64748B] hover:text-[#F43F5E] hover:bg-[rgba(244,63,94,0.1)] rounded-lg transition"
                    title="Delete entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-[#161B26] border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-[#64748B]">
            No journal entries recorded yet. Save your first check-in above!
          </div>
        )}
      </div>
    </div>
  );
}
