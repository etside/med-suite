import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Pill, Zap, BarChart3, ShieldCheck, Users, Smartphone, Languages, TrendingUp, Moon, Sun } from "lucide-react";
import { LanguageToggleLanding } from "@/components/LanguageToggleLanding";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Animated counter hook ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// ── Section reveal variants ────────────────────────────────────────────────────
const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const childVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// ── Feature data ──────────────────────────────────────────────────────────────
const features = [
  { icon: Pill, title: "Full Inventory Control", desc: "Batch numbers, expiry alerts, stock levels — updated in real time." },
  { icon: Zap, title: "4-Second Checkout", desc: "Barcode scan → receipt. Multiple payment methods, zero friction." },
  { icon: BarChart3, title: "Live Analytics", desc: "Sales trends, top products, and revenue — always current." },
  { icon: ShieldCheck, title: "Secure by Design", desc: "Biometric auth, audit trails, and role-based access built in." },
  { icon: Users, title: "Staff & Roles", desc: "Granular permissions. Track performance and manage shifts." },
  { icon: Smartphone, title: "Offline PWA", desc: "Works without internet. Installs on phone. Syncs automatically." },
  { icon: Languages, title: "English + বাংলা", desc: "Full bilingual UI — switch language at any time, for any user." },
  { icon: TrendingUp, title: "Demand Forecasting", desc: "Predictive restocking alerts before you run out." },
];

// ── Pricing tiers ─────────────────────────────────────────────────────────────
const pricingPlans = [
  {
    name: "Starter",
    price: "৳0",
    period: "Free forever",
    desc: "For solo pharmacists getting started",
    features: ["Up to 500 products", "POS & sales", "Basic reports", "Mobile PWA"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "৳1,499",
    period: "per month",
    desc: "For growing pharmacies that need more",
    features: [
      "Unlimited products",
      "Advanced analytics",
      "Staff management",
      "Customer ledger",
      "Priority support",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    desc: "Multi-branch chains and custom needs",
    features: [
      "Everything in Pro",
      "Multi-location sync",
      "Custom integrations",
      "Dedicated manager",
      "24/7 phone support",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

// ── Terminal stat block ───────────────────────────────────────────────────────
function TerminalBlock({ started }: { started: boolean }) {
  const medicines = useCountUp(1200, 1600, started);
  const accuracy = useCountUp(98, 1400, started);
  const checkout = useCountUp(4, 800, started);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm font-mono text-sm overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-white/5 border-b border-white/10">
        <span className="h-3 w-3 rounded-full bg-red-400/60" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/60" />
        <span className="h-3 w-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-white/30 text-xs">medsuite-et — live stats</span>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5 text-white/80">
        <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-4">
          <span className="text-white/40 text-xs uppercase tracking-widest">medicines tracked</span>
          <span className="text-3xl font-bold text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {medicines.toLocaleString()}
            <span className="text-[#F5A623]">+</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-4">
          <span className="text-white/40 text-xs uppercase tracking-widest">stock accuracy</span>
          <span className="text-3xl font-bold text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {accuracy}
            <span className="text-[#F5A623]">%</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-4">
          <span className="text-white/40 text-xs uppercase tracking-widest">checkout time</span>
          <span className="text-3xl font-bold text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {checkout}
            <span className="text-[#F5A623] text-lg">s avg</span>
          </span>
        </div>

        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            System operational · Last synced just now
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const Landing = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isDark, setIsDark] = useState(false);

  // Hero terminal trigger
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true, amount: 0.3 });

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors">

        {/* ── Navbar ──────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 bg-[#1E3A5F] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#F5A623]/20 flex items-center justify-center">
                <img src="/logo.svg" alt="" className="h-5 w-5 object-contain" />
              </div>
              <span
                className="font-bold text-white text-base"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Med<span className="text-[#F5A623]">Suite eT</span>
              </span>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDark(!isDark)}
                className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <LanguageToggleLanding />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/auth")}
                className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:inline-flex"
              >
                {t("nav_login") || "Sign in"}
              </Button>
              <Button
                size="sm"
                onClick={() => navigate("/auth")}
                className="bg-[#F5A623] hover:bg-[#e09510] text-[#1E3A5F] font-semibold"
              >
                {t("nav_get_started") || "Get started"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="bg-[#1E3A5F] min-h-[88vh] flex items-center py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: headline */}
              <motion.div
                variants={sectionVariants}
                initial="hidden"
                animate={heroInView ? "visible" : "hidden"}
                className="space-y-6"
              >
                <p className="text-[#F5A623] text-xs font-semibold uppercase tracking-widest">
                  Pharmacy Management · Made for Bangladesh
                </p>
                <h1
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Your pharmacy,
                  <br />
                  <span className="text-[#F5A623]">fully in control.</span>
                </h1>
                <p className="text-gray-300 text-lg leading-relaxed max-w-lg" style={{ fontFamily: "Inter, sans-serif" }}>
                  Medsuite eT handles your stock, sales, and staff — so you can focus on the patient in front of you.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    size="lg"
                    onClick={() => navigate("/auth")}
                    className="bg-[#F5A623] hover:bg-[#e09510] text-[#1E3A5F] font-bold px-6"
                  >
                    {t("hero_cta_trial") || "Start free trial"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/auth")}
                    className="border-white/30 text-white hover:bg-white/10 hover:border-white/60"
                  >
                    {t("hero_cta_demo") || "See a demo"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-white/50">
                  <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#F5A623]" /> No credit card</span>
                  <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#F5A623]" /> Works offline</span>
                  <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#F5A623]" /> English &amp; বাংলা</span>
                </div>
              </motion.div>

              {/* Right: terminal */}
              <motion.div
                variants={{ hidden: { opacity: 0, x: 32 }, visible: { opacity: 1, x: 0, transition: { duration: 0.7, delay: 0.2 } } }}
                initial="hidden"
                animate={heroInView ? "visible" : "hidden"}
              >
                <TerminalBlock started={heroInView} />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────── */}
        <FeaturesSection />

        {/* ── Pricing ─────────────────────────────────────────── */}
        <PricingSection navigate={navigate} t={t} />

        {/* ── CTA banner ──────────────────────────────────────── */}
        <CtaSection navigate={navigate} t={t} />

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="bg-[#1E3A5F] border-t border-white/10 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#F5A623]/20 flex items-center justify-center">
                  <img src="/logo.svg" alt="" className="h-5 w-5 object-contain" />
                </div>
                <div>
                  <span
                    className="font-bold text-white text-sm block"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Med<span className="text-[#F5A623]">Suite eT</span>
                  </span>
                  <span className="text-white/40 text-xs">Pharmacy management, simplified</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-white/40">
                <button className="hover:text-white transition-colors">{t("nav_features") || "Features"}</button>
                <button className="hover:text-white transition-colors">{t("nav_pricing") || "Pricing"}</button>
                <button className="hover:text-white transition-colors">{t("nav_contact") || "Contact"}</button>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-white/30">
              © 2026 Medsuite-eT — All rights reserved. Made with 💙 by engineersTech
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ── Features section ──────────────────────────────────────────────────────────
function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section ref={ref} className="bg-white dark:bg-slate-950 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="mb-12"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F5A623] mb-3">
            What you get
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Everything a modern pharmacy needs
          </h2>
        </motion.div>

        <motion.div
          variants={staggerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={childVariant}
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-all duration-200 hover:border-t-2 hover:border-t-[#F5A623]"
            >
              <div className="h-9 w-9 rounded-md bg-[#1E3A5F]/10 dark:bg-[#1E3A5F]/30 flex items-center justify-center mb-4">
                <f.icon className="h-4 w-4 text-[#1E3A5F] dark:text-blue-300" />
              </div>
              <h3
                className="font-bold text-slate-900 dark:text-white mb-1"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {f.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Pricing section ───────────────────────────────────────────────────────────
function PricingSection({ navigate, t }: { navigate: (path: string) => void; t: (k: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section ref={ref} className="bg-slate-50 dark:bg-slate-900/50 py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="mb-12"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F5A623] mb-3">
            Pricing
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Simple, transparent plans
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-base">
            Start free. Upgrade as you grow.
          </p>
        </motion.div>

        <motion.div
          variants={staggerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
        >
          {pricingPlans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={childVariant}
              className={[
                "rounded-xl border bg-white dark:bg-slate-900 p-6 flex flex-col gap-5",
                plan.highlight
                  ? "border-[#1E3A5F] dark:border-[#F5A623]/60 ring-2 ring-[#1E3A5F]/20 dark:ring-[#F5A623]/10"
                  : "border-slate-200 dark:border-slate-800",
              ].join(" ")}
            >
              {plan.highlight && (
                <span className="self-start text-[10px] font-semibold uppercase tracking-widest bg-[#F5A623]/15 text-[#c47e0a] dark:text-[#F5A623] rounded px-2 py-0.5">
                  Most popular
                </span>
              )}
              <div>
                <h3
                  className="text-xl font-bold text-slate-900 dark:text-white"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {plan.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{plan.desc}</p>
              </div>
              <div>
                <span
                  className="text-4xl font-bold text-slate-900 dark:text-white"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {plan.price}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">{plan.period}</span>
              </div>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="h-4 w-4 text-[#1E3A5F] dark:text-[#F5A623] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/auth")}
                className={
                  plan.highlight
                    ? "bg-[#1E3A5F] hover:bg-[#162d4a] text-white w-full"
                    : "w-full"
                }
                variant={plan.highlight ? "default" : "outline"}
              >
                {plan.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── CTA section ───────────────────────────────────────────────────────────────
function CtaSection({ navigate, t }: { navigate: (path: string) => void; t: (k: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section ref={ref} className="bg-[#1E3A5F] py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="space-y-6"
        >
          <h2
            className="text-3xl sm:text-4xl font-bold text-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Ready to take control of your pharmacy?
          </h2>
          <p className="text-gray-300 text-lg">
            Join pharmacies across Bangladesh running on Medsuite eT.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-[#F5A623] hover:bg-[#e09510] text-[#1E3A5F] font-bold px-8"
            >
              {t("hero_cta_trial") || "Start free trial"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Landing;
