import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BarcodeGenerator } from "./BarcodeGenerator";
import { Printer } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  batch_number?: string | null;
}

interface BulkBarcodeDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: Product[];
  mode: "barcode" | "qr";
}

export function BulkBarcodeDialog({ open, onOpenChange, products, mode }: BulkBarcodeDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(products.map((p) => p.id)));
  const printRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>Barcodes</title><style>
      body{margin:0;padding:10px;font-family:sans-serif;font-size:11px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .item{border:1px solid #ddd;padding:8px;text-align:center;page-break-inside:avoid}
      .item p{margin:2px 0}
      @media print{@page{margin:3mm}.grid{grid-template-columns:repeat(4,1fr)!important}}
    </style></head><body>`);
    w.document.write(printRef.current.innerHTML);
    w.document.write("</body></html>");
    w.document.close();
    w.print();
  };

  const selectedProducts = products.filter((p) => selected.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk {mode === "barcode" ? "Barcode" : "QR Code"} Generation & Print</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={selected.size === products.length} onCheckedChange={toggleAll} />
            <span className="text-sm font-medium">Select All ({selected.size}/{products.length})</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer text-xs hover:bg-accent/50">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div ref={printRef}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {selectedProducts.map((p) => (
              <div key={p.id} className="item border rounded p-2 text-center" style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>
                <BarcodeGenerator value={p.batch_number || String(p.id).slice(0, 12)} height={35} width={1.5} fontSize={10} />
                <p style={{ margin: "2px 0", fontSize: "8pt", fontWeight: "bold" }}>{p.name}</p>
                <p style={{ margin: "2px 0", fontSize: "7pt" }}>৳{Number(p.price).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint} disabled={selected.size === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print {selected.size} Barcodes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
