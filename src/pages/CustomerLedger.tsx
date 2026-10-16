import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Users, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface CustomerData {
  user_id: string;
  name: string;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  total_paid: number;
  due: number;
}

const CustomerLedger = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    let profiles: Awaited<ReturnType<typeof api.profiles.list>>;
    let orderData: Awaited<ReturnType<typeof api.orders.list>>;
    try {
      [profiles, orderData] = await Promise.all([api.profiles.list(), api.orders.list()]);
    } catch (e: unknown) {
      toast.error(t("cl_load_failed") + ": " + (e instanceof Error ? e.message : "Unknown error"));
      return;
    }
    if (!profiles.length) return;

    const orderMap: Record<string, { count: number; total: number; paid: number }> = {};
    (orderData || []).forEach((o: any) => {
      if (!orderMap[o.user_id]) orderMap[o.user_id] = { count: 0, total: 0, paid: 0 };
      orderMap[o.user_id].count++;
      orderMap[o.user_id].total += Number(o.total);
      if (o.payment_status === "paid") orderMap[o.user_id].paid += Number(o.total);
    });

    setCustomers(profiles.map((p: any) => {
      const om = orderMap[p.user_id] || { count: 0, total: 0, paid: 0 };
      return {
        user_id: p.user_id,
        name: p.full_name || "Unknown",
        phone: p.phone,
        total_orders: om.count,
        total_spent: om.total,
        total_paid: om.paid,
        due: om.total - om.paid,
      };
    }).filter((c) => c.total_orders > 0));
  };

  const viewHistory = async (customer: CustomerData) => {
    setSelectedCustomer(customer);
    try {
      const data = await api.orders.list({ user_id: customer.user_id });
      setOrders(data as any[]);
    } catch {
      setOrders([]);
    }
    setDialogOpen(true);
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> {t("nav_customer_ledger")}
        </h1>
        <p className="text-muted-foreground">{t("cl_subtitle")}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t("cl_total_customers")}</p><p className="text-2xl font-bold">{customers.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t("cl_total_revenue")}</p><p className="text-2xl font-bold text-primary">৳{customers.reduce((s, c) => s + c.total_spent, 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t("cl_total_due")}</p><p className="text-2xl font-bold text-destructive">৳{customers.reduce((s, c) => s + c.due, 0).toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t("cl_accounts")} ({filtered.length})</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("cl_search_ph")} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("cl_customer")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("sales_phone")}</TableHead>
                <TableHead className="text-right">{t("cl_orders")}</TableHead>
                <TableHead className="text-right">{t("cl_total_spent")}</TableHead>
                <TableHead className="text-right">{t("cl_paid")}</TableHead>
                <TableHead className="text-right">{t("cl_due")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.user_id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell className="text-right">{c.total_orders}</TableCell>
                  <TableCell className="text-right">৳{c.total_spent.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-primary">৳{c.total_paid.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={c.due > 0 ? "destructive" : "secondary"}>৳{c.due.toLocaleString()}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => viewHistory(c)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("cl_order_history")} — {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">৳{Number(o.total).toFixed(2)}</p>
                  <Badge variant={o.payment_status === "paid" ? "secondary" : "destructive"} className="text-[10px]">{o.payment_status}</Badge>
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="text-center text-muted-foreground py-4">{t("cl_no_orders")}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default CustomerLedger;
