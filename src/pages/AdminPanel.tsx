import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, Package, ShoppingCart, AlertTriangle, TrendingUp, Clock, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const WHATSAPP_HELP = "https://wa.me/8801873722228?text=Hi%2C%20I%20need%20help%20with%20Medsuite-eT%20platform";

const AdminPanel = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, lowStock: 0, revenue: 0, suppliers: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [d, sales, orders] = await Promise.all([
          api.dashboard(),
          api.sales.list(),
          api.orders.list(),
        ]);
        const revenue = (sales as any[]).reduce((s: number, i: any) => s + Number(i.total), 0);
        setStats({
          users: d.user_count,
          products: d.product_count,
          orders: orders.length,
          lowStock: d.low_stock,
          revenue,
          suppliers: d.supplier_count,
          pending: d.pending_approvals,
        });
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    if (isAdmin) fetchStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="py-20 text-center text-muted-foreground">{t("admin_access_denied")}</div>;
  }

  const cards = [
    { title: t("admin_total_users"), value: loading ? "…" : stats.users, icon: Users, color: "text-blue-600" },
    { title: t("admin_pending_approvals"), value: loading ? "…" : stats.pending, icon: Clock, color: "text-amber-600" },
    { title: t("admin_products"), value: loading ? "…" : stats.products, icon: Package, color: "text-primary" },
    { title: t("admin_total_orders"), value: loading ? "…" : stats.orders, icon: ShoppingCart, color: "text-amber-600" },
    { title: t("admin_low_stock_items"), value: loading ? "…" : stats.lowStock, icon: AlertTriangle, color: "text-destructive" },
    { title: t("admin_pos_revenue"), value: loading ? "…" : "৳" + stats.revenue.toLocaleString(), icon: TrendingUp, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> {t("nav_admin")}
          </h1>
          <p className="text-muted-foreground">{t("admin_subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href={WHATSAPP_HELP} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 text-green-600" /> {t("um_whatsapp_help")} (+880 1873722228)
          </a>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_sysinfo")}</CardTitle>
          <CardDescription>{t("admin_version")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("admin_backend")}</span><Badge variant="secondary">MySQL / PHP API</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("admin_php_fallback")}</span><Badge variant="outline">{t("admin_available")}</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("admin_pwa")}</span><Badge>{t("yes")}</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("admin_barcode_qr")}</span><Badge>JsBarcode + QRCode</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("admin_thermal")}</span><Badge variant="secondary">80mm Ready</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("admin_deployment")}</span><Badge variant="secondary">Netlify / cPanel / Lovable</Badge></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_faq")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><p className="font-medium">{t("admin_faq0_q")}</p><p className="text-muted-foreground">{t("admin_faq0_a")}</p></div>
          <div><p className="font-medium">{t("admin_faq1_q")}</p><p className="text-muted-foreground">{t("admin_faq1_a")}</p></div>
          <div><p className="font-medium">{t("admin_faq2_q")}</p><p className="text-muted-foreground">{t("admin_faq2_a")}</p></div>
          <div><p className="font-medium">{t("admin_faq3_q")}</p>
            <a href={WHATSAPP_HELP} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {t("admin_contact_whatsapp")}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default AdminPanel;
