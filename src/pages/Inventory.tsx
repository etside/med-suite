import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package, TrendingDown, Clock, Barcode, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { BulkBarcodeDialog } from "@/components/BulkBarcodeDialog";
import { ExcelImportExport } from "@/components/ExcelImportExport";
import { UserManual } from "@/components/UserManual";
import { BarcodeGenerator } from "@/components/BarcodeGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Inventory = () => {
  const { isStaff } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState({ total: 0, low_stock: 0, out_of_stock: 0, expiring_soon: 0 });
  const PAGE_SIZE = 50;

  const fetchProducts = () => {
    setLoading(true);
    Promise.all([
      api.products.list({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort: "stock_asc" }),
      api.products.inventoryStats(),
    ])
      .then(([rows, s]) => { setProducts(rows as any[]); setStats(s); })
      .catch((e: unknown) => toast.error("Failed to load inventory: " + (e instanceof Error ? e.message : "Unknown error")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, [page]);

  const paged = products;
  const pageCount = Math.max(1, Math.ceil(stats.total / PAGE_SIZE));

  const lowStock = stats.low_stock;
  const outOfStock = stats.out_of_stock;
  const expiringSoon = stats.expiring_soon;

  const getExpiryStatus = (date: string | null) => {
    if (!date) return "none";
    const diff = new Date(date).getTime() - Date.now();
    if (diff < 0) return "expired";
    if (diff < 30 * 24 * 60 * 60 * 1000) return "expiring";
    return "ok";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">Stock levels, expiry alerts & barcode management</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <UserManual page="inventory" />
          {isStaff && (
            <>
              <ExcelImportExport onImported={fetchProducts} />
              <Button variant="outline" size="sm" onClick={() => setBarcodeOpen(true)}>
                <Barcode className="mr-1 h-3.5 w-3.5" /> Print Barcodes
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingDown className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{lowStock}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{outOfStock}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{expiringSoon}</div></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stock Overview</CardTitle>
          <CardDescription>Current inventory levels with expiry tracking & barcodes</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Batch</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="hidden md:table-cell">Barcode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading inventory…</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No items</TableCell></TableRow>
              ) : paged.map((item) => {
                const stockStatus = item.stock === 0 ? "out" : item.stock < item.min_stock ? "low" : "ok";
                const expiryStatus = getExpiryStatus(item.expiry_date);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">{item.batch_number || "—"}</TableCell>
                    <TableCell className="text-right">{item.stock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.min_stock}</TableCell>
                    <TableCell>
                      <Badge variant={stockStatus === "out" ? "destructive" : stockStatus === "low" ? "outline" : "secondary"}>
                        {stockStatus === "out" ? "Out of Stock" : stockStatus === "low" ? "Low Stock" : "In Stock"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.expiry_date ? (
                        <Badge variant={expiryStatus === "expired" ? "destructive" : expiryStatus === "expiring" ? "outline" : "secondary"}>
                          {expiryStatus === "expired" ? "Expired" : item.expiry_date}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="scale-[0.5] origin-left">
                        <BarcodeGenerator value={item.batch_number || String(item.id).slice(0, 12)} height={25} width={1} displayValue={false} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <span className="text-muted-foreground">Showing {paged.length} of {stats.total} — page {page + 1}/{pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <BulkBarcodeDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} products={products} mode="barcode" />
    </div>
  );
};

export default Inventory;
