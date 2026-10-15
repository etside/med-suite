import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Truck, Package, Search } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const Purchases = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact_person: "", phone: "", email: "", address: "" });
  const [newPO, setNewPO] = useState({ supplier_id: "", notes: "", items: [{ product_id: "", product_name: "", quantity: 1, unit_cost: 0 }] });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [po, sup] = await Promise.all([
        api.purchaseOrders.list(),
        api.suppliers.list(),
      ]);
      setOrders(po as any[]);
      setSuppliers((sup as any[]).sort((a, b) => String(a.name).localeCompare(String(b.name))));
    } catch (e: unknown) {
      toast.error("Failed to load purchases: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Server-side product search for the PO picker (never fetch the full 22k catalog here)
  useEffect(() => {
    if (!dialogOpen) return;
    const q = productQuery.trim();
    if (q.length < 2) { setProductResults([]); return; }
    setSearchingProducts(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.products.list({ search: q, limit: 50 });
        setProductResults(res as any[]);
      } catch {
        setProductResults([]);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [productQuery, dialogOpen]);

  const addItem = () => setNewPO((po) => ({ ...po, items: [...po.items, { product_id: "", product_name: "", quantity: 1, unit_cost: 0 }] }));
  const removeItem = (i: number) => setNewPO((po) => ({ ...po, items: po.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, key: string, val: any) => {
    setNewPO((po) => {
      const items = [...po.items];
      items[i] = { ...items[i], [key]: val };
      if (key === "product_id") {
        const p = productResults.find((pr) => pr.id === val);
        if (p) { items[i].product_name = p.name; items[i].unit_cost = Number(p.price); }
      }
      return { ...po, items };
    });
  };

  const handleCreatePO = async () => {
    if (!newPO.supplier_id || newPO.items.length === 0 || !newPO.items[0].product_id) {
      toast.error("Select a supplier and at least one product");
      return;
    }
    setSaving(true);
    const poNumber = "PO-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
    const total = newPO.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

    try {
      await api.purchaseOrders.create({
        po_number: poNumber,
        supplier_id: newPO.supplier_id,
        status: "ordered",
        total,
        notes: newPO.notes || null,
        items: newPO.items.map((i) => ({
          product_id: i.product_id || null,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          total_cost: i.quantity * i.unit_cost,
        })),
      });
    } catch (e: any) {
      toast.error("Failed: " + (e.message || ""));
      setSaving(false);
      return;
    }

    toast.success("Purchase Order created: " + poNumber);
    setDialogOpen(false);
    setNewPO({ supplier_id: "", notes: "", items: [{ product_id: "", product_name: "", quantity: 1, unit_cost: 0 }] });
    setSaving(false);
    fetchAll();
  };

  const handleReceive = async (poId: string) => {
    try {
      await api.purchaseOrders.updateStatus(poId, "received");
      toast.success("PO received! Stock updated automatically.");
      fetchAll();
    } catch (e: any) {
      toast.error("Failed: " + (e.message || ""));
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) { toast.error("Supplier name required"); return; }
    try {
      await api.suppliers.create(newSupplier);
    } catch (e: any) {
      toast.error("Failed: " + (e.message || ""));
      return;
    }
    toast.success("Supplier added!");
    setSupplierDialogOpen(false);
    setNewSupplier({ name: "", contact_person: "", phone: "", email: "", address: "" });
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground">Track medicine purchases from suppliers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSupplierDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Add Supplier
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />New Purchase Order
          </Button>
        </div>
      </div>

      {/* Suppliers summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {suppliers.slice(0, 4).map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-4 pb-3">
              <p className="font-medium text-sm truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.contact_person || s.phone || "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Purchase Orders ({orders.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Total (৳)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading purchase orders…</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow>
              ) : orders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono font-medium text-sm">{po.po_number}</TableCell>
                  <TableCell>{po.supplier_name || "—"}</TableCell>
                  <TableCell className="text-right">৳{Number(po.total).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={po.status === "received" ? "default" : po.status === "ordered" ? "secondary" : "outline"}>{po.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{new Date(po.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {po.status === "ordered" && (
                      <Button size="sm" variant="outline" onClick={() => handleReceive(po.id)}>
                        <Truck className="mr-1 h-3 w-3" /> Receive
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New PO Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={newPO.supplier_id} onValueChange={(v) => setNewPO((po) => ({ ...po, supplier_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Items</Label>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Find product (type 2+ letters)</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-9 text-xs pl-8" placeholder="Search 22k+ catalog…" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
                </div>
                {searchingProducts && <p className="text-xs text-muted-foreground">Searching…</p>}
              </div>
              {newPO.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select value={item.product_id} onValueChange={(v) => updateItem(i, "product_id", v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={productResults.length ? "Pick from results" : "Search above first"} /></SelectTrigger>
                      <SelectContent>
                        {productResults.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — ৳{Number(p.price).toFixed(0)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={1} className="h-9 text-xs" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" min={0} step={0.01} className="h-9 text-xs" value={item.unit_cost} onChange={(e) => updateItem(i, "unit_cost", Number(e.target.value))} />
                  </div>
                  <div className="col-span-2 flex gap-1">
                    <span className="text-xs self-center">৳{(item.quantity * item.unit_cost).toFixed(0)}</span>
                    {newPO.items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeItem(i)}>×</Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Add Item</Button>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={newPO.notes} onChange={(e) => setNewPO((po) => ({ ...po, notes: e.target.value }))} />
            </div>
            <div className="text-right font-bold">
              Total: ৳{newPO.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0).toLocaleString()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePO} disabled={saving}>{saving ? "Creating..." : "Create PO"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Supplier Dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Company Name *</Label><Input value={newSupplier.name} onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Contact Person</Label><Input value={newSupplier.contact_person} onChange={(e) => setNewSupplier((s) => ({ ...s, contact_person: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={newSupplier.phone} onChange={(e) => setNewSupplier((s) => ({ ...s, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={newSupplier.email} onChange={(e) => setNewSupplier((s) => ({ ...s, email: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={newSupplier.address} onChange={(e) => setNewSupplier((s) => ({ ...s, address: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSupplier}>Add Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default Purchases;