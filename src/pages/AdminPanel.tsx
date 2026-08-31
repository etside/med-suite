import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, Package, ShoppingCart, AlertTriangle, TrendingUp, Clock, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const WHATSAPP_HELP = "https://wa.me/8801873722228?text=Hi%2C%20I%20need%20help%20with%20Medsuite-eT%20platform";

const AdminPanel = () => {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, lowStock: 0, revenue: 0, suppliers: 0, pending: 0 });

  useEffect(() => {
    const fetchStats = async () => {
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
      } catch { /* ignore */ }
    };
    if (isAdmin) fetchStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="py-20 text-center text-muted-foreground">Access denied. Admin only.</div>;
  }

  const cards = [
    { title: "Total Users", value: stats.users, icon: Users, color: "text-blue-600" },
    { title: "Pending Approvals", value: stats.pending, icon: Clock, color: "text-amber-600" },
    { title: "Products", value: stats.products, icon: Package, color: "text-primary" },
    { title: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-amber-600" },
    { title: "Low Stock Items", value: stats.lowStock, icon: AlertTriangle, color: "text-destructive" },
    { title: "POS Revenue", value: "৳" + stats.revenue.toLocaleString(), icon: TrendingUp, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Admin Panel
          </h1>
          <p className="text-muted-foreground">System administration dashboard</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href={WHATSAPP_HELP} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp Help (+880 1873722228)
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
          <CardTitle>System Information</CardTitle>
          <CardDescription>Medsuite-eT Pharmacy Management v2.0</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Backend</span><Badge variant="secondary">MySQL / PHP API</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">PHP Fallback</span><Badge variant="outline">Available</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">PWA Ready</span><Badge>Yes</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Barcode/QR</span><Badge>JsBarcode + QRCode</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Thermal Print</span><Badge variant="secondary">80mm Ready</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Deployment</span><Badge variant="secondary">Netlify / cPanel / Lovable</Badge></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ & Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><p className="font-medium">How to reset a user's password?</p><p className="text-muted-foreground">Users can use "Forgot Password" on the login page. As admin you can change their role from User Management.</p></div>
          <div><p className="font-medium">How to connect a barcode scanner?</p><p className="text-muted-foreground">Plug in any USB barcode scanner. It acts as a keyboard. Open POS page and scan — product auto-adds to cart.</p></div>
          <div><p className="font-medium">How to setup thermal printer?</p><p className="text-muted-foreground">Connect an 80mm thermal printer. After a sale, click "Print Receipt". The receipt is optimized for 80mm width.</p></div>
          <div><p className="font-medium">Platform issues or feature requests?</p>
            <a href={WHATSAPP_HELP} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Contact Super Admin via WhatsApp: +8801873722228
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default AdminPanel;
