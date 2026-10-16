import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Check, Pill, ShoppingCart, Warehouse, BarChart3,
  QrCode, Store, ClipboardList, ShieldCheck, Smartphone, Languages,
  Moon, Sun, Zap, Users,
} from "lucide-react";
import { LanguageToggleLanding } from "@/components/LanguageToggleLanding";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";

// ── Real app modules (route-linked, proper labels) ──────────────────────────
const buildModules = (t: (k: string) => string) => [
  { icon: ShoppingCart, title: t("land_m1_t"), desc: t("land_m1_d"), path: "/sales", tag: t("land_m1_g") },
  { icon: Pill, title: t("land_m2_t"), desc: t("land_m2_d"), path: "/products", tag: t("land_m2_g") },
  { icon: Warehouse, title: t("land_m3_t"), desc: t("land_m3_d"), path: "/inventory", tag: t("land_m3_g") },
  { icon: ClipboardList, title: t("land_m4_t"), desc: t("land_m4_d"), path: "/purchases", tag: t("land_m4_g") },
  { icon: BarChart3, title: t("land_m5_t"), desc: t("land_m5_d"), path: "/reports", tag: t("land_m5_g") },
  { icon: QrCode, title: t("land_m6_t"), desc: t("land_m6_d"), path: "/qr-scanner", tag: t("land_m6_g") },
  { icon: Store, title: t("land_m7_t"), desc: t("land_m7_d"), path: "/shop", tag: t("land_m7_g") },
  { icon: Users, title: t("land_m8_t"), desc: t("land_m8_d"), path: "/admin/users", tag: t("land_m8_g") },
];

const buildSteps = (t: (k: string) => string) => [
  { n: "1", title: t("land_s1_t"), desc: t("land_s1_d") },
  { n: "2", title: t("land_s2_t"), desc: t("land_s2_d") },
  { n: "3", title: t("land_s3_t"), desc: t("land_s3_d") },
];

const buildPlans = (t: (k: string) => string) => [
  { name: t("land_p1_name"), price: "৳0", period: t("land_p1_period"), desc: t("land_p1_desc"), features: [t("land_p1_f1"), t("land_p1_f2"), t("land_p1_f3"), t("land_p1_f4")], cta: t("land_p1_cta"), highlight: false },
  { name: t("land_p2_name"), price: "৳1,499", period: t("land_p2_period"), desc: t("land_p2_desc"), features: [t("land_p2_f1"), t("land_p2_f2"), t("land_p2_f3"), t("land_p2_f4"), t("land_p2_f5")], cta: t("land_p2_cta"), highlight: true },
  { name: t("land_p3_name"), price: "Custom", period: t("land_p3_period"), desc: t("land_p3_desc"), features: [t("land_p3_f1"), t("land_p3_f2"), t("land_p3_f3"), t("land_p3_f4")], cta: t("land_p3_cta"), highlight: false },
];

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isDark, setIsDark] = useState(false);
  const modules = buildModules(t);
  const steps = buildSteps(t);
  const plans = buildPlans(t);

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50">

        {/* ── Navbar ── */}
        <nav aria-label="Primary" className="sticky top-0 z-50 bg-[#1E3A5F] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#F5A623]/20 flex items-center justify-center">
                <img src="/logo.svg" alt="MedSuite eT logo" width={20} height={20} className="h-5 w-5 object-contain" />
              </div>
              <span className="font-bold text-white text-base">Med<span className="text-[#F5A623]">Suite eT</span></span>
              <span className="hidden md:inline text-white/40 text-xs ml-2">{t("land_brand_sub")}</span>
            </div>
            <div className="flex items-center gap-2">
              <a href="#modules" className="hidden md:inline text-white/70 hover:text-white text-sm px-2">{t("land_nav_modules")}</a>
              <a href="#how" className="hidden md:inline text-white/70 hover:text-white text-sm px-2">{t("land_nav_how")}</a>
              <a href="#pricing" className="hidden md:inline text-white/70 hover:text-white text-sm px-2">{t("land_nav_pricing")}</a>
              <Button variant="ghost" size="sm" onClick={() => setIsDark(!isDark)} className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 p-0" aria-label="Toggle dark mode">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <LanguageToggleLanding />
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:inline-flex">
                {t("auth_signin")}
              </Button>
              <Button size="sm" onClick={() => navigate("/auth")} className="bg-[#F5A623] hover:bg-[#e09510] text-[#1E3A5F] font-semibold">
                {t("nav_get_started")} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>

        {/* ── Hero (renders immediately — no scroll gate) ── */}
        <section className="bg-[#1E3A5F]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <p className="inline-flex items-center gap-2 text-[#F5A623] text-xs font-semibold uppercase tracking-widest bg-[#F5A623]/10 rounded-full px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F5A623]" /> {t("land_hero_badge")}
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
                {t("land_hero_title_pre")}<br /><span className="text-[#F5A623]">{t("land_hero_title_hl")}</span>
              </h1>
              <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-lg">
                {t("land_hero_sub")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/auth")} className="bg-[#F5A623] hover:bg-[#e09510] text-[#1E3A5F] font-bold px-6">
                  {t("hero_cta_trial")} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/sales")} className="border-white/30 text-white hover:bg-white/10">
                  {t("land_open_pos")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#F5A623]" /> {t("land_no_cc")}</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#F5A623]" /> {t("land_works_offline")}</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#F5A623]" /> {t("land_eng_bn")}</span>
              </div>
            </div>

            {/* Live status card — static numbers, no rAF loop */}
            <div className="rounded-xl border border-white/10 bg-white/5 font-mono text-sm overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 bg-white/5 border-b border-white/10">
                <span className="h-3 w-3 rounded-full bg-red-400/60" />
                <span className="h-3 w-3 rounded-full bg-yellow-400/60" />
                <span className="h-3 w-3 rounded-full bg-green-400/60" />
                <span className="ml-3 text-white/40 text-xs">medsuite-et — live</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> {t("land_operational")}
                </span>
              </div>
              <div className="p-5 sm:p-6 space-y-4 text-white/80">
                <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-4">
                  <span className="text-white/50 text-xs uppercase tracking-widest">{t("land_products_live")}</span>
                  <span className="text-3xl font-bold text-white">1,000<span className="text-[#F5A623]">+</span></span>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-4">
                  <span className="text-white/50 text-xs uppercase tracking-widest">{t("land_avg_checkout")}</span>
                  <span className="text-3xl font-bold text-white">4<span className="text-[#F5A623] text-lg">s</span></span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-white/50 text-xs uppercase tracking-widest">{t("land_receipt_print")}</span>
                  <span className="text-3xl font-bold text-white">72<span className="text-[#F5A623] text-lg">mm</span></span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="rounded-lg bg-white/5 px-2 py-2.5">
                    <Zap className="h-4 w-4 mx-auto text-[#F5A623]" /><p className="text-[11px] mt-1 text-white/70">{t("land_fast_pos")}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-2 py-2.5">
                    <ShieldCheck className="h-4 w-4 mx-auto text-[#F5A623]" /><p className="text-[11px] mt-1 text-white/70">{t("land_role_access")}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-2 py-2.5">
                    <Smartphone className="h-4 w-4 mx-auto text-[#F5A623]" /><p className="text-[11px] mt-1 text-white/70">{t("land_offline_pwa")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Modules (real routes, proper labels) ── */}
        <section id="modules" className="py-14 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#c47e0a] mb-2">{t("land_modules_eyebrow")}</p>
            <h2 className="text-2xl sm:text-4xl font-bold">{t("land_modules_title")}</h2>
            <p className="mt-2 text-slate-500 max-w-2xl">{t("land_modules_sub")}</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {modules.map((m) => (
                <button key={m.path + m.title} onClick={() => navigate(m.path)}
                  className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[#F5A623] hover:shadow-md transition group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="h-9 w-9 rounded-md bg-[#1E3A5F]/10 flex items-center justify-center">
                      <m.icon className="h-4 w-4 text-[#1E3A5F] dark:text-blue-300" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{m.tag}</span>
                  </div>
                  <h3 className="font-bold">{m.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-1">{m.desc}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A5F] dark:text-[#F5A623] mt-3">
                    {t("land_open")} <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1"><Languages className="h-3.5 w-3.5" /> {t("land_badge_lang")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1"><Smartphone className="h-3.5 w-3.5" /> {t("land_badge_pwa")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1"><ShieldCheck className="h-3.5 w-3.5" /> {t("land_badge_roles")}</span>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="bg-slate-50 dark:bg-slate-900/50 py-14 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#c47e0a] mb-2">{t("land_how_eyebrow")}</p>
            <h2 className="text-2xl sm:text-4xl font-bold">{t("land_how_title")}</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-4">
              {steps.map((s) => (
                <div key={s.n} className="rounded-xl border bg-white dark:bg-slate-900 p-6">
                  <span className="h-8 w-8 rounded-full bg-[#1E3A5F] text-white text-sm font-bold flex items-center justify-center">{s.n}</span>
                  <h3 className="font-bold mt-4">{s.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#c47e0a] mb-2">{t("land_pricing_eyebrow")}</p>
            <h2 className="text-2xl sm:text-4xl font-bold">{t("land_pricing_title")}</h2>
            <p className="mt-2 text-slate-500">{t("land_pricing_sub")}</p>
            <div className="mt-8 grid md:grid-cols-3 gap-5 items-start">
              {plans.map((plan) => (
                <div key={plan.name} className={`rounded-xl border bg-white dark:bg-slate-900 p-6 flex flex-col gap-5 ${plan.highlight ? "border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20" : "border-slate-200 dark:border-slate-800"}`}>
                  {plan.highlight && <span className="self-start text-[10px] font-semibold uppercase tracking-widest bg-[#F5A623]/15 text-[#c47e0a] rounded px-2 py-0.5">{t("land_most_popular")}</span>}
                  <div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{plan.desc}</p>
                  </div>
                  <div><span className="text-4xl font-bold">{plan.price}</span><span className="text-sm text-slate-500 ml-2">{plan.period}</span></div>
                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm"><Check className="h-4 w-4 text-[#1E3A5F] dark:text-[#F5A623] shrink-0 mt-0.5" />{f}</li>
                    ))}
                  </ul>
                  <Button onClick={() => navigate("/auth")} variant={plan.highlight ? "default" : "outline"} className={plan.highlight ? "bg-[#1E3A5F] hover:bg-[#162d4a] text-white w-full" : "w-full"}>
                    {plan.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-[#1E3A5F] py-14">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-5">
            <h2 className="text-2xl sm:text-4xl font-bold text-white">{t("land_cta_title")}</h2>
            <p className="text-gray-300">{t("land_cta_sub")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => navigate("/auth")} className="bg-[#F5A623] hover:bg-[#e09510] text-[#1E3A5F] font-bold px-8">
                {t("hero_cta_trial")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/shop")} className="border-white/30 text-white hover:bg-white/10">{t("land_browse_shop")}</Button>
            </div>
          </div>
        </section>

        <footer className="bg-[#1E3A5F] border-t border-white/10 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="MedSuite eT logo" width={20} height={20} className="h-5 w-5" />
              <div>
                <span className="font-bold text-white text-sm block">Med<span className="text-[#F5A623]">Suite eT</span></span>
                <span className="text-white/40 text-xs">{t("land_footer_note")}</span>
              </div>
            </div>
            <div className="flex items-center gap-5 text-sm text-white/50">
              <a href="#modules" className="hover:text-white">{t("land_nav_modules")}</a>
              <a href="#pricing" className="hover:text-white">{t("land_nav_pricing")}</a>
              <a href="https://wa.me/8801873722228" target="_blank" rel="noreferrer" className="hover:text-white">{t("land_footer_contact")}</a>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-white/30">{t("land_copyright")}</p>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
