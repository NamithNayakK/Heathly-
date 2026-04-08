import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ClipboardList,
  Heart,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
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
    <main className="min-h-screen animated-gradient text-white">
      <header className="sticky top-0 z-20 px-4 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/30 bg-white/20 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 font-semibold">
            <Heart className="h-5 w-5" />
            <span>Healthly</span>
          </div>
          <div className="hidden gap-6 text-sm md:flex">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#about">About</a>
          </div>
          <div className="flex gap-2">
            <Link className="btn-glass text-sm text-slate-800" to="/login">
              Login
            </Link>
            <Link className="btn-primary text-sm" to="/login">
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 md:grid-cols-2 md:items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur">
            <ShieldCheck className="h-4 w-4" /> Secure and private support
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Mental wellness support designed for daily life
          </h1>
          <p className="mt-4 max-w-xl text-white/85">
            Take assessments, get supportive AI guidance, and track your emotional wellbeing in one calm, personal dashboard.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="btn-primary inline-flex items-center gap-2" to="/login">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <a className="btn-secondary border-white text-white hover:bg-white hover:text-indigo-700" href="#features">
              Explore Features
            </a>
          </div>
        </motion.div>

        <motion.div
          className="card-glass float-animation relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="absolute -right-14 -top-14 h-32 w-32 rounded-full bg-pink-300/40 blur-2xl" />
          <div className="absolute -bottom-14 -left-14 h-32 w-32 rounded-full bg-cyan-300/40 blur-2xl" />
          <div className="relative space-y-4 text-slate-800">
            <h3 className="text-xl font-semibold">Today at a glance</h3>
            <div className="rounded-xl bg-white/80 p-4">
              <p className="text-sm text-slate-600">Mood trend</p>
              <p className="text-2xl font-bold text-indigo-700">Improving</p>
            </div>
            <div className="rounded-xl bg-white/80 p-4">
              <p className="text-sm text-slate-600">Next recommended action</p>
              <p className="font-semibold">5-minute breathing routine</p>
            </div>
            <div className="rounded-xl bg-white/80 p-4">
              <p className="text-sm text-slate-600">Current risk level</p>
              <p className="font-semibold text-emerald-600">Low</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10" id="features">
        <h2 className="text-center text-3xl font-bold">Core Features</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {featureCards.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card-neuro text-slate-800"
              >
                <Icon className="h-8 w-8 text-indigo-600" />
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.description}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10" id="how-it-works">
        <h2 className="text-center text-3xl font-bold">How It Works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step, idx) => (
            <div key={step} className="card-glass text-slate-800">
              <p className="text-sm font-semibold text-indigo-600">Step {idx + 1}</p>
              <p className="mt-2 text-lg font-semibold">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="about" className="mt-12 bg-black/20 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4">
          <div>
            <p className="text-xl font-semibold">Healthly</p>
            <p className="text-sm text-white/80">Compassionate mental wellness support for students and professionals.</p>
          </div>
          <div className="flex items-center gap-4 text-white/90">
            <Brain className="h-5 w-5" />
            <BookOpen className="h-5 w-5" />
            <MessageCircle className="h-5 w-5" />
          </div>
        </div>
      </footer>
    </main>
  );
}
