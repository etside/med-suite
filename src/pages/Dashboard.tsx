import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package, ShoppingCart, TrendingUp, AlertTriangle, DollarSign, Clock,
  BarChart3, FileText, Settings, Users, QrCode, ClipboardList, Bell, User,
  Shield, BookUser, MessageCircle, Warehouse, Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Onboarding from "@/components/Onboarding";
import { containerVariants, itemVariants } from "@/components/PageTransition";

const WHATSAPP_HELP = "https://wa.me/8801873722228?text=Hi%2C%20I%20need%20help%20with%20MedSuite";

const NAV_TILES = [
  { titleKey: "nav_sales", icon: ShoppingCart, path: "/sales" },
  { titleKey: "nav_products", icon: Package, path: "/products" },
  { titleKey: "nav_manufacturers", icon: Building2, path: "/manufacturers" },
  { titleKey: "nav_inventory", icon: Warehouse, path: "/inventory" },
  { titleKey: "nav_purchases", icon: ClipboardList, path: "/purchases" },
  { titleKey: "nav_reports", icon: BarChart3, path: "/reports" },
  { titleKey: "nav_qr_scanner", icon: QrCode, path: "/qr-scanner" },
  { titleKey: "admin_orders", icon: ClipboardList, path: "/admin/orders" },
  { titleKey: "nav_notifications", icon: Bell, path: "/notifications" },
  { titleKey: "nav_profile", icon: User, path: "/profile" },
  { titleKey: "nav_user_mgmt", icon: Users, path: "/admin/users", adminOnly: true },
  { titleKey: "nav_admin", icon: Shield, path: "/admin", adminOnly: true },
  { titleKey: "nav_settings", icon: Settings, path: "/settings", adminOnly: true },
  { titleKey: "nav_customer_ledger", icon: BookUser, path: "/admin/customers", adminOnly: true },
] as const;

const Dashboard = () => {
  const { isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [topSelling, setTopSelling] = useState<{ name: string; qty: number }[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [weeklySales, setWeeklySales] = useState<{ day: string; sales: number }[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!isStaff) {
      setStatsLoading(false);
      return;
    }
    let cancelled = false;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const stats = await api.dashboard();
        setProductCount(stats.product_count);
        setLowStockCount(stats.low_stock);
        setPendingOrders(stats.pending_orders);
        setExpiringCount(stats.expiring_soon);
        setTodaySales(stats.today_sales);
        setMonthlyRevenue(stats.monthly_revenue);
        setTopSelling(stats.top_selling || []);

        const labels: string[] = [];
        const byDay: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString("en-US", { weekday: "short" });
          labels.push(key);
          byDay[key] = 0;
        }
        (stats.week_sales || []).forEach((s) => {
          const key = new Date(s.created_at).toLocaleDateString("en-US", { weekday: "short" });
          if (key in byDay) {
            byDay[key] = (byDay[key] || 0) + Number(s.total);
          }
        });
        setWeeklySales(labels.map((day) => ({ day, sales: byDay[day] ?? 0 })));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  useEffect(() => {
    const onboardingCompleted = localStorage.getItem("onboarding_completed");
    if (!onboardingCompleted && isStaff) {
      setShowOnboarding(true);
    }
  }, [isStaff]);

  // Derive stat card variant classes based on values
  const kpis = useMemo(
    () => [
      {
        title: t("dash_total_products"),
        value: String(productCount),
        icon: Package,
        iconColor: "bg-[#1E3A5F] text-white",
        cardClass: "stat-card-ok",
        path: "/inventory",
      },
      {
        title: t("dash_low_stock"),
        value: String(lowStockCount),
        icon: AlertTriangle,
        iconColor: "bg-amber-500/15 text-amber-500",
        cardClass: lowStockCount > 10 ? "stat-card-alert" : lowStockCount > 0 ? "stat-card-warn" : "stat-card-ok",
        path: "/inventory",
      },
      {
        title: t("dash_today_sales"),
        value: "৳" + todaySales.toLocaleString(),
        icon: DollarSign,
        iconColor: "bg-[#1E3A5F] text-white",
        cardClass: "stat-card-ok",
        path: "/sales",
      },
      {
        title: t("dash_monthly_revenue"),
        value: "৳" + monthlyRevenue.toLocaleString(),
        icon: TrendingUp,
        iconColor: "bg-[#1E3A5F] text-white",
        cardClass: "stat-card-ok",
        path: "/reports",
      },
      {
        title: t("dash_pending_orders"),
        value: String(pendingOrders),
        icon: ClipboardList,
        iconColor: "bg-amber-500/15 text-amber-500",
        cardClass: pendingOrders > 0 ? "stat-card-warn" : "stat-card-ok",
        path: "/admin/orders",
      },
      {
        title: t("dash_expiring_soon"),
        value: String(expiringCount),
        icon: Clock,
        iconColor: "bg-red-500/15 text-red-500",
        cardClass: expiringCount > 0 ? "stat-card-alert" : "stat-card-ok",
        path: "/inventory",
      },
    ],
    [t, productCount, lowStockCount, todaySales, monthlyRevenue, pendingOrders, expiringCount],
  );

  const visibleTiles = useMemo(
    () => NAV_TILES.filter((tile) => !("adminOnly" in tile && tile.adminOnly) || isAdmin),
    [isAdmin],
  );

  // ── Guest view ──────────────────────────────────────────
  if (!isStaff) {
    return (
      <div className="space-y-6 px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {t("dash_welcome_guest")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dash_guest_sub")}</p>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Card className="card-interactive cursor-pointer" onClick={() => navigate("/shop")}>
            <CardContent className="flex items-center gap-3 p-4">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{t("nav_shop")}</p>
                <p className="text-xs text-muted-foreground">{t("shop_subtitle")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-interactive cursor-pointer" onClick={() => navigate("/track-order")}>
            <CardContent className="flex items-center gap-3 p-4">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{t("order_title")}</p>
                <p className="text-xs text-muted-foreground">{t("dash_track_sub")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Staff / Admin view ──────────────────────────────────
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Page header ─────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold text-foreground"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {t("dash_title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("dash_welcome")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0 hover:border-[#F5A623]/60 hover:text-[#F5A623]"
          asChild
        >
          <a href={WHATSAPP_HELP} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            {t("whatsapp_support")}
          </a>
        </Button>
      </motion.div>

      {/* ── Quick action tiles ───────────────────────────── */}
      <motion.div variants={itemVariants}>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          {t("dash_quick_actions") || "Quick Access"}
        </p>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {visibleTiles.map((tile) => (
            <button
              key={tile.path}
              type="button"
              onClick={() => navigate(tile.path)}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 sm:p-4 text-center transition-all duration-200 hover:border-t-2 hover:border-t-[#F5A623] hover:-translate-y-0.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1E3A5F]/10 text-[#1E3A5F] dark:bg-[#1E3A5F]/30 dark:text-blue-300">
                <tile.icon className="h-4 w-4" />
              </span>
              <span className="text-[10px] sm:text-xs font-medium leading-tight text-foreground">
                {t(tile.titleKey)}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── KPI stat cards ──────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          {t("dash_overview") || "Overview"}
        </p>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {statsLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-7 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))
            : kpis.map((kpi) => (
                <div
                  key={kpi.title}
                  className={`${kpi.cardClass} card-interactive cursor-pointer rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5`}
                  onClick={() => navigate(kpi.path)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(kpi.path)}
                >
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${kpi.iconColor}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <p
                    className="text-2xl sm:text-3xl font-bold truncate text-foreground"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {kpi.value}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mt-1 leading-tight">
                    {kpi.title}
                  </p>
                </div>
              ))}
        </div>
      </motion.div>

      {/* ── Charts ──────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-2">
        {/* Weekly sales chart */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("dash_weekly_sales") || "Weekly Sales"}
            </p>
            <CardTitle className="text-base font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {t("dash_revenue_trend")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {statsLoading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : weeklySales.every((d) => d.sales === 0) ? (
              <p className="text-center text-muted-foreground py-12 text-sm">{t("dash_no_sales")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklySales}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v: number) => [`৳${v.toLocaleString()}`, t("dash_sales")]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                      fontSize: 12,
                    }}
                    cursor={{ stroke: "#1E3A5F", strokeWidth: 1, strokeDasharray: "4 2" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#1E3A5F"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                    dot={{ fill: "#1E3A5F", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#F5A623", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("dash_top_products") || "Top Products"}
            </p>
            <CardTitle className="text-base font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {t("dash_most_sold")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {statsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : topSelling.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">{t("no_results")}</p>
            ) : (
              <ul className="space-y-2">
                {topSelling.map((item, i) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1E3A5F]/10 text-[#1E3A5F] text-xs font-bold dark:bg-[#1E3A5F]/30 dark:text-blue-300">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.qty} {t("dash_units")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
    </motion.div>
  );
};

export default Dashboard;
