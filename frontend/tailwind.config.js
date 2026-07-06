/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base:     "#0B1120",
        surface:  "#111827",
        elevated: "#161B26",
        overlay:  "#1C2333",
        teal:  { DEFAULT:"#5EEAD4", dim:"rgba(94,234,212,0.12)", glow:"rgba(94,234,212,0.30)", dark:"#2DD4BF" },
        lav:   { DEFAULT:"#A78BFA", dim:"rgba(167,139,250,0.12)", glow:"rgba(167,139,250,0.30)", dark:"#7C3AED" },
        amber: { DEFAULT:"#FCD34D", dim:"rgba(252,211,77,0.12)",  glow:"rgba(252,211,77,0.30)",  dark:"#F59E0B" },
        rose:  { DEFAULT:"#F43F5E", dim:"rgba(244,63,94,0.12)" },
        cyan:  "#06B6D4", emerald:"#10B981", violet:"#7C3AED", blue:"#3B82F6",
      },
      fontFamily: {
        display: ["'Fraunces'","Georgia","serif"],
        sans:    ["'Inter'","system-ui","sans-serif"],
        mono:    ["'IBM Plex Mono'","monospace"],
      },
      animation: {
        breathe:    "breathe 4s ease-in-out infinite",
        float:      "float 8s ease-in-out infinite",
        pulseSoft:  "pulseSoft 2.5s ease-in-out infinite",
        bounceSoft: "bounceSoft 2s ease-in-out infinite",
        fadeUp:     "fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both",
        glowRing:   "glowRing 3s ease-in-out infinite",
      },
      keyframes: {
        breathe:    {"0%,100%":{opacity:"0.7",transform:"scale(1)"},"50%":{opacity:"1",transform:"scale(1.04)"}},
        float:      {"0%,100%":{transform:"translateY(0px)"},"50%":{transform:"translateY(-14px)"}},
        pulseSoft:  {"0%,100%":{boxShadow:"0 0 0 0 rgba(94,234,212,0)"},"50%":{boxShadow:"0 0 0 12px rgba(94,234,212,0.12)"}},
        bounceSoft: {"0%,100%":{transform:"translateY(0)"},"50%":{transform:"translateY(6px)"}},
        fadeUp:     {from:{opacity:"0",transform:"translateY(24px)"},to:{opacity:"1",transform:"translateY(0)"}},
        glowRing:   {"0%,100%":{filter:"drop-shadow(0 0 6px rgba(94,234,212,0.3))"},"50%":{filter:"drop-shadow(0 0 16px rgba(94,234,212,0.7))"}},
      },
      boxShadow: {
        "teal-glow":    "0 0 28px rgba(94,234,212,0.28)",
        "lav-glow":     "0 0 28px rgba(167,139,250,0.28)",
        "card-float":   "0 8px 40px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};
