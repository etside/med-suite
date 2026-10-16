import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { categories } from "@/data/categories";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSaved: () => void;
}

const defaultProduct = {
  name: "", name_bn: "", generic_name: "", manufacturer: "", category: "analgesic",
  price: 0, price_leaf: 0, price_box: 0,
  pcs_per_leaf: 1, leaves_per_box: 1,
  stock: 0, min_stock: 10, batch_number: "", expiry_date: "",
  requires_prescription: false, description: "", description_bn: "", image_url: "",
};

type PriceMode = "pcs" | "leaf" | "box";
const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function ProductDialog({ open, onOpenChange, product, onSaved }: ProductDialogProps) {
  const [form, setForm] = useState(defaultProduct);
  const [saving, setSaving] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode>("pcs");
  const isEdit = !!product;

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "", name_bn: product.name_bn || "",
        generic_name: product.generic_name || "", manufacturer: product.manufacturer || "",
        category: product.category || "analgesic",
        price: product.price || 0,
        price_leaf: product.price_leaf || 0,
        price_box: product.price_box || 0,
        pcs_per_leaf: product.pcs_per_leaf || 1,
        leaves_per_box: product.leaves_per_box || 1,
        stock: product.stock || 0, min_stock: product.min_stock || 10,
        batch_number: product.batch_number || "", expiry_date: product.expiry_date || "",
        requires_prescription: product.requires_prescription || false,
        description: product.description || "", description_bn: product.description_bn || "",
        image_url: product.image_url || "",
      });
    } else {
      setForm(defaultProduct);
      setPriceMode("pcs");
    }
  }, [product, open]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  /**
   * Auto-derive all three prices from the unit the admin edits.
   * 1 Box = leaves_per_box Leaves = (leaves_per_box * pcs_per_leaf) Pcs
   */
  const derive = (mode: PriceMode, value: number, p: number, b: number) => {
    p = Math.max(1, p); b = Math.max(1, b);
    let pcs = 0, leaf = 0, box = 0;
    if (mode === "box") { box = value; leaf = box / b; pcs = box / (b * p); }
    else if (mode === "leaf") { leaf = value; pcs = leaf / p; box = leaf * b; }
    else { pcs = value; leaf = pcs * p; box = leaf * b; }
    return { price: round2(pcs), price_leaf: round2(leaf), price_box: round2(box) };
  };

  const onPriceChange = (mode: PriceMode, raw: string) => {
    const value = raw === "" ? 0 : Number(raw);
    setPriceMode(mode);
    setForm((f) => ({
      ...f,
      ...derive(mode, value, Number(f.pcs_per_leaf) || 1, Number(f.leaves_per_box) || 1),
      // keep the exact number the admin typed in the field they edited
      ...(mode === "pcs" ? { price: raw } : mode === "leaf" ? { price_leaf: raw } : { price_box: raw }),
    }));
  };

  const onUnitChange = (key: "pcs_per_leaf" | "leaves_per_box", raw: string) => {
    setForm((f) => {
      const next = { ...f, [key]: raw };
      const p = Number(key === "pcs_per_leaf" ? raw : f.pcs_per_leaf) || 1;
      const b = Number(key === "leaves_per_box" ? raw : f.leaves_per_box) || 1;
      const base = Number(priceMode === "pcs" ? f.price : priceMode === "leaf" ? f.price_leaf : f.price_box) || 0;
      return { ...next, ...derive(priceMode, base, p, b) };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    setSaving(true);

    const payload = {
      name: form.name, name_bn: form.name_bn || null, generic_name: form.generic_name || null,
      manufacturer: form.manufacturer || null,
      category: form.category, price: Number(form.price),
      price_leaf: Number(form.price_leaf), price_box: Number(form.price_box),
      pcs_per_leaf: Math.max(1, Number(form.pcs_per_leaf) || 1),
      leaves_per_box: Math.max(1, Number(form.leaves_per_box) || 1),
      stock: Number(form.stock),
      min_stock: Number(form.min_stock), batch_number: form.batch_number || null,
      expiry_date: form.expiry_date || null, requires_prescription: form.requires_prescription,
      description: form.description || null, description_bn: form.description_bn || null,
      image_url: form.image_url || null,
    };

    try {
      if (isEdit) {
        await api.products.update(product.id, payload);
      } else {
        await api.products.create(payload);
      }
    } catch (e: any) {
      setSaving(false);
      toast.error("Failed: " + (e.message || ""));
      return;
    }

    setSaving(false);
    toast.success(isEdit ? "Product updated!" : "Product added!");
    onOpenChange(false);
    onSaved();
  };

  const p = Math.max(1, Number(form.pcs_per_leaf) || 1);
  const b = Math.max(1, Number(form.leaves_per_box) || 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Product Image</Label>
            <ImageUpload currentUrl={form.image_url} onUploaded={(url) => set("image_url", url)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name (English) *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Name (বাংলা)</Label>
              <Input value={form.name_bn} onChange={(e) => set("name_bn", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Generic Name</Label>
            <Input value={form.generic_name} onChange={(e) => set("generic_name", e.target.value)} placeholder="e.g. Paracetamol 500mg" />
          </div>
          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="e.g. Square Pharmaceuticals" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Unit hierarchy */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-semibold">Packaging Units</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pieces per Leaf</Label>
                <Input type="number" min={1} value={form.pcs_per_leaf} onChange={(e) => onUnitChange("pcs_per_leaf", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Leaves per Box</Label>
                <Input type="number" min={1} value={form.leaves_per_box} onChange={(e) => onUnitChange("leaves_per_box", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">1 Box = {b} Leaf{b !== 1 ? "s" : ""} = {b * p} Pcs</p>

            <p className="text-sm font-semibold pt-1">Pricing — edit any one, the rest auto-calculate</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Box (৳)</Label>
                <Input type="number" min={0} step={0.01} value={form.price_box} onChange={(e) => onPriceChange("box", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Leaf (৳)</Label>
                <Input type="number" min={0} step={0.01} value={form.price_leaf} onChange={(e) => onPriceChange("leaf", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Pcs (৳)</Label>
                <Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => onPriceChange("pcs", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Stock (pcs)</Label>
              <Input type="number" min={0} value={form.stock} onChange={(e) => set("stock", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stock (pcs)</Label>
              <Input type="number" min={0} value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Batch No.</Label>
              <Input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.requires_prescription} onCheckedChange={(v) => set("requires_prescription", v)} />
              <Label>Requires Prescription</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (English)</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description (বাংলা)</Label>
            <Textarea rows={2} value={form.description_bn} onChange={(e) => set("description_bn", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : isEdit ? "Update" : "Add Product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
