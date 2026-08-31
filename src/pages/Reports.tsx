import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { Download, RefreshCw, ChevronDown, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

const COLORS = ["hsl(174, 84%, 32%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(142, 76%, 36%)", "hsl(0, 84%, 60%)"];

type RangeDays = "7" | "14" | "30" | "all";

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const Reports = () => {
  const { t } = useLanguage();
  const [salesData, setSalesData] = useState<{ date: string; revenue: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; units: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState<RangeDays>("14");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const sales = await api.sales.list();
      const cutoff =
        rangeDays === "all"
          ? null
          : new Date(Date.now() - Number(rangeDays) * 24 * 60 * 60 * 1000);

      const filtered = cutoff
        ? sales.filter((s: { created_at: string }) => new Date(s.created_at) >= cutoff)
        : sales;

      const byDay: Record<string, number> = {};
      filtered.forEach((s: { created_at: string; total: number }) => {
        const day = new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        byDay[day] = (byDay[day] || 0) + Number(s.total);
      });
      setSalesData(
        Object.entries(byDay)
          .slice(0, 30)
          .reverse()
          .map(([date, revenue]) => ({ date, revenue }))
      );
      setTotalRevenue(filtered.reduce((sum: number, i: { total: number }) => sum + Number(i.total), 0));

      const byProduct: Record<string, number> = {};
      filtered.forEach((s: { items?: unknown }) => {
        let items = s.items;
        if (typeof items === "string") {
          try {
            items = JSON.parse(items);
          } catch {
            items = [];
          }
        }
        (items as { name?: string; product_name?: string; qty?: number; quantity?: number }[] || []).forEach((i) => {
          const name = i.name || i.product_name;
          if (name) byProduct[name] = (byProduct[name] || 0) + Number(i.qty || i.quantity || 1);
        });
      });

      const orders = await api.orders.list();
      const orderCutoff = cutoff;
      const recentOrders = orderCutoff
        ? orders.filter((o: { created_at?: string }) => o.created_at && new Date(o.created_at) >= orderCutoff)
        : orders;

      const orderItemsResults = await Promise.all(
        recentOrders.slice(0, 50).map(async (order: { id: string | number }) => {
          try {
            return await api.orders.items(String(order.id));
          } catch {
            return [] as { product_name: string; quantity: number }[];
          }
        })
      );
      orderItemsResults.forEach((items) => {
        items.forEach((i: { product_name: string; quantity: number }) => {
          byProduct[i.product_name] = (byProduct[i.product_name] || 0) + Number(i.quantity);
        });
      });
      setTopProducts(
        Object.entries(byProduct)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, units]) => ({ name, units }))
      );
      setTotalOrders(recentOrders.length);

      const prods = await api.products.list();
      const byCat: Record<string, number> = {};
      (prods as { category?: string; stock?: number }[]).forEach((p) => {
        byCat[p.category || "Other"] = (byCat[p.category || "Other"] || 0) + Number(p.stock);
      });
      setCategoryData(Object.entries(byCat).map(([name, value]) => ({ name, value })));
      setLastUpdated(new Date());
    } catch {
      toast.error(t("reports_load_error"));
    } finally {
      setLoading(false);
    }
  }, [rangeDays, t]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const exportSalesCsv = () => {
    if (salesData.length === 0) {
      toast.error(t("reports_no_data"));
      return;
    }
    downloadCsv(`sales-report-${rangeDays}d.csv`, [
      ["Date", "Revenue (BDT)"],
      ...salesData.map((d) => [d.date, String(d.revenue)]),
    ]);
    toast.success(t("reports_export_done"));
  };

  const exportFullSummary = () => {
    if (salesData.length === 0 && topProducts.length === 0) {
      toast.error(t("reports_no_data"));
      return;
    }
    const rows: string[][] = [
      ["Medsuite-eT Report Summary"],
      ["Period (days)", rangeDays === "all" ? "All time" : rangeDays],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Total POS Revenue (BDT)", String(totalRevenue)],
      ["Online Orders", String(totalOrders)],
      [],
      ["Daily Sales"],
      ["Date", "Revenue"],
      ...salesData.map((d) => [d.date, String(d.revenue)]),
      [],
      ["Top Products"],
      ["Product", "Units Sold"],
      ...topProducts.map((p) => [p.name, String(p.units)]),
    ];
    downloadCsv(`medsuite-full-report-${rangeDays}d.csv`, rows);
    toast.success(t("reports_export_done"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("reports_title")}</h1>
          <p className="text-muted-foreground">{t("reports_subtitle")}</p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("reports_last_updated")}: {lastUpdated.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={rangeDays} onValueChange={(v) => setRangeDays(v as RangeDays)}>
            <SelectTrigger className="w-[140px]" aria-label={t("reports_period")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("reports_range_7")}</SelectItem>
              <SelectItem value="14">{t("reports_range_14")}</SelectItem>
              <SelectItem value="30">{t("reports_range_30")}</SelectItem>
              <SelectItem value="all">{t("reports_range_all")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} aria-label={t("reports_refresh")}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("reports_refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={loading} aria-label="Print report">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                <Download className="mr-2 h-4 w-4" />
                {t("reports_export")}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportSalesCsv}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t("reports_export_sales")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportFullSummary}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t("reports_export_full")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("reports_automation_title")}</CardTitle>
          <CardDescription>{t("reports_automation_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("reports_automation_hint")}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total POS Revenue</p>
            <p className="text-2xl font-bold text-primary">
              {loading ? "…" : `৳${totalRevenue.toLocaleString()}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Online Orders</p>
            <p className="text-2xl font-bold">{loading ? "…" : totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Products Tracked</p>
            <p className="text-2xl font-bold">
              {loading ? "…" : categoryData.reduce((s, c) => s + c.value, 0)} units
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="flex w-full max-w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="daily" className="flex-1 min-w-[7rem]">Sales Trend</TabsTrigger>
          <TabsTrigger value="products" className="flex-1 min-w-[7rem]">Top Products</TabsTrigger>
          <TabsTrigger value="categories" className="flex-1 min-w-[7rem]">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Daily Sales Trend</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
              ) : salesData.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No sales data yet. Complete POS sales to see trends.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280} minHeight={240}>
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis width={48} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(174, 84%, 32%)" fill="hsl(174, 84%, 32%)" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Top Selling Products</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
              ) : topProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No order data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280} minHeight={240}>
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="units" fill="hsl(174, 84%, 32%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Stock by Category</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
              ) : (
                <ResponsiveContainer width="100%" height={280} minHeight={240}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default Reports;
