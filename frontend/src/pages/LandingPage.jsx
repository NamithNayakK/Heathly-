import { ArrowRight, BookOpen, Brain, ClipboardList, Heart, MessageCircle, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const featureCards = [
  {
    title: "PHQ-9 Assessment",
    description: "Clinically aligned 9-question assessment to understand your wellbeing status.",
    icon: ClipboardList,
  },
  {
    title: "AI Support",
    description: "Empathetic AI chat with emotion detection and CBT-inspired support guidance.",
    icon: MessageCircle,
  },
  {
    title: "Track Progress",
    description: "Monitor your scores and recovery trends through a personalized dashboard.",
    icon: TrendingUp,
  },
];

const steps = [
  "Take Assessment",
  "Get Personalized Insights",
  "Receive Support and Resources",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 font-bold text-teal-700 text-xl">
            <Heart className="h-6 w-6" />
            <span>Healthly</span>
          </div>
          <div className="hidden gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-teal-700">Features</a>
            <a href="#how-it-works" className="hover:text-teal-700">How It Works</a>
            <a href="#about" className="hover:text-teal-700">About</a>
          </div>
          <div className="flex gap-3">
            <Link className="btn-secondary text-sm" to="/login">Login</Link>
            <Link className="btn-primary text-sm" to="/login">Sign Up</Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 md:grid-cols-2 md:items-center">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-teal-50 text-teal-700 px-4 py-1.5 text-sm font-medium border border-teal-100">
            <ShieldCheck className="h-4 w-4" /> Secure and private support
          </p>
          <h1 className="text-4xl font-extrabold text-slate-900 leading-tight md:text-5xl">
            Professional mental wellness support for daily life
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-600">
            Take clinically-aligned assessments, receive supportive guidance, and track your emotional wellbeing in one secure, personalized dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link className="btn-primary inline-flex items-center gap-2 text-lg px-6 py-3" to="/login">
              Get Started <ArrowRight className="h-5 w-5" />
            </Link>
            <a className="btn-secondary inline-flex items-center gap-2 text-lg px-6 py-3" href="#features">
              Explore Features
            </a>
          </div>
        </div>

        <div className="card-glass relative overflow-hidden bg-white border border-slate-200 shadow-sm p-8 rounded-xl">
          <div className="relative space-y-6 text-slate-800">
            <h3 className="text-xl font-bold border-b border-slate-100 pb-3">Today at a glance</h3>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-sm font-medium text-slate-500">Mood trend</p>
              <p className="text-2xl font-bold text-teal-700 mt-1">Improving</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-sm font-medium text-slate-500">Next recommended action</p>
              <p className="font-semibold text-slate-900 mt-1">5-minute breathing routine</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
              <p className="text-sm font-medium text-slate-500">Current risk level</p>
              <p className="font-semibold text-emerald-600 mt-1">Low</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-t border-slate-200 py-20" id="features">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">Core Features</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {featureCards.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="card-glass bg-white">
                  <div className="bg-teal-50 w-14 h-14 rounded-lg flex items-center justify-center mb-6">
                    <Icon className="h-7 w-7 text-teal-700" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-slate-600 leading-relaxed">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20" id="how-it-works">
        <h2 className="text-center text-3xl font-bold text-slate-900">How It Works</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, idx) => (
            <div key={step} className="card-glass bg-white text-center py-8">
              <div className="mx-auto w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-xl mb-4">
                {idx + 1}
              </div>
              <p className="text-lg font-bold text-slate-900">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="about" className="bg-slate-900 text-slate-400 py-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4">
          <div>
            <div className="flex items-center gap-2 font-bold text-white text-xl mb-2">
              <Heart className="h-5 w-5" /> Healthly
            </div>
            <p className="text-sm">Professional mental wellness support.</p>
          </div>
          <div className="flex items-center gap-6">
            <Brain className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
            <BookOpen className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
            <MessageCircle className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>
      </footer>
    </main>
  );
}
