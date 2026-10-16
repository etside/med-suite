import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Search, CheckCircle2, Clock, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const statusSteps = [
  { key: "pending", icon: Clock },
  { key: "confirmed", icon: CheckCircle2 },
  { key: "processing", icon: Package },
  { key: "delivered", icon: Truck },
];

const OrderTracking = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [searchId, setSearchId] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const handleTrack = async () => {
    if (!searchId.trim()) {
      toast.error(lang === "bn" ? "অর্ডার আইডি দিন" : "Enter order ID");
      return;
    }
    try {
      const data = await api.orders.track(searchId.trim().toUpperCase());
      setOrder(data);
      setOrderItems((data as any).items || []);
    } catch {
      setOrder(null);
      setOrderItems([]);
    }
    setSearched(true);
  };

  const statusIndex = order ? statusSteps.findIndex(s => s.key === order.status) : -1;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("order_title")}</h1>
        <p className="text-muted-foreground">{t("order_subtitle")}</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input placeholder={t("order_enter_id")} value={searchId} onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrack()} className="flex-1" />
            <Button onClick={handleTrack}><Search className="mr-2 h-4 w-4" /> {t("order_track")}</Button>
          </div>
        </CardContent>
      </Card>

      {searched && !order && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">{t("ot_not_found")}</CardContent></Card>
      )}

      {order && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("order_status")}</CardTitle>
              <Badge variant="secondary" className="font-mono">{order.order_number}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              {statusSteps.map((step, i) => (
                <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${i <= statusIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] text-center ${i <= statusIndex ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {t(("order_" + step.key) as any)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm">
              {orderItems.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.product_name} × {item.quantity}</span>
                  <span>৳{Number(item.total_price).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>{t("sales_total")}</span>
                <span>৳{Number(order.total).toFixed(2)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">{t("sales_payment_method")}</p><p className="font-medium">{order.payment_method}</p></div>
              {order.transaction_id && <div><p className="text-xs text-muted-foreground">{t("pay_trx_id")}</p><p className="font-mono text-xs">{order.transaction_id}</p></div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderTracking;
