import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Barcode } from "lucide-react";
import { api } from "@/lib/api";
import { ProductDialog } from "@/components/ProductDialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ExcelImportExport } from "@/components/ExcelImportExport";
import { BulkBarcodeDialog } from "@/components/BulkBarcodeDialog";
import { UserManual } from "@/components/UserManual";
import { BarcodeGenerator } from "@/components/BarcodeGenerator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Products = () => {
  const { isStaff } = useAuth();
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category") || "";
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchProducts = () => {
    setLoading(true);
    api.products.list()
      .then((data) => setProducts(data as any[]))
      .catch((e: unknown) => toast.error("Failed to load products: " + (e instanceof Error ? e.message : "Unknown error")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => { setPage(0); }, [search, categoryFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.products.delete(deleteId);
      toast.success("Product deleted");
      fetchProducts();
    } catch (e: any) {
      toast.error("Delete failed: " + (e.message || "Unknown error"));
    }
    setDeleteId(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.generic_name || "").toLowerCase().includes(q) ||
        (p.batch_number || "").toLowerCase().includes(q);
      const matchCategory = !categoryFilter || (p.category || "") === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [products, search, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage]
  );

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date).getTime() < Date.now();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground">Medicine catalog with batch tracking & barcodes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <UserManual page="products" />
          {isStaff && (
            <>
              <ExcelImportExport onImported={fetchProducts} />
              <Button variant="outline" size="sm" onClick={() => setBarcodeOpen(true)}>
                <Barcode className="mr-1 h-3.5 w-3.5" /> Barcodes
              </Button>
              <Button onClick={() => { setEditProduct(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />Add Product
              </Button>
            </>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>All Products ({filtered.length})</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search medicines..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Generic</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price (৳)</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="hidden md:table-cell">Barcode</TableHead>
                <TableHead>Expiry</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading products…</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
              ) : paged.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded object-cover aspect-square" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs aspect-square">No img</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.name}
                    {p.requires_prescription && <Badge variant="destructive" className="ml-1 text-[9px] px-1">Rx</Badge>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{p.generic_name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                  <TableCell className="text-right">৳{Number(p.price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.stock === 0 ? "destructive" : p.stock < p.min_stock ? "outline" : "secondary"}>{p.stock}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(p.batch_number || p.id) && (
                      <div className="scale-[0.6] origin-left">
                        <BarcodeGenerator value={p.batch_number || String(p.id).slice(0, 12)} height={25} width={1} displayValue={false} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.expiry_date ? (
                      <Badge variant={isExpired(p.expiry_date) ? "destructive" : isExpiringSoon(p.expiry_date) ? "outline" : "secondary"}>
                        {p.expiry_date}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  {isStaff && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditProduct(p); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <span className="text-muted-foreground">Showing {paged.length} of {filtered.length} — page {safePage + 1}/{pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editProduct} onSaved={fetchProducts} />
      <BulkBarcodeDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} products={products} mode="barcode" />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The product will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
