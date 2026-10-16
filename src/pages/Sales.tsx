import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Minus, Trash2, Printer, ShoppingCart, X, ScanBarcode, Camera } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { InvoicePrint } from "@/components/InvoicePrint";
import { UserManual } from "@/components/UserManual";

type Unit = "box" | "leaf" | "pcs";

interface CartItem {
  id: string;            // productId + ":" + unit — allows the same product on separate unit lines
  productId: string;
  name: string;
  price: number;         // price for the chosen unit
  qty: number;           // number of chosen units
  pcs_each: number;      // pieces per chosen unit (for stock + display)
  unit: Unit;
  category?: string;
  prices: { pcs: number; leaf: number; box: number };
  pcsPer: { leaf: number; box: number };
}

/** Resolve { price, pcs_each, prices } for a unit given a product's config. */
function unitInfo(p: any, unit: Unit) {
  const pl = Math.max(1, Number(p.pcs_per_leaf) || 1);
  const lb = Math.max(1, Number(p.leaves_per_box) || 1);
  const pcsPrice = Number(p.price) || 0;
  const prices = {
    pcs: pcsPrice,
    leaf: Number(p.price_leaf) || pcsPrice * pl,
    box: Number(p.price_box) || pcsPrice * pl * lb,
  };
  const pcsPer = { leaf: pl, box: pl * lb };
  if (unit === "box") return { price: prices.box, pcs_each: pcsPer.box, prices, pcsPer };
  if (unit === "leaf") return { price: prices.leaf, pcs_each: pcsPer.leaf, prices, pcsPer };
  return { price: prices.pcs, pcs_each: 1, prices, pcsPer };
}

/**
 * Memoized product row. Props are stable (product object identity + a stable
 * onAdd callback), so adding items to the cart does NOT re-render the grid —
 * critical for smooth rapid scanning during a large sell.
 */
const ProductRow = memo(function ProductRow({
  product: p,
  onAdd,
}: {
  product: any;
  onAdd: (p: any, unit: Unit) => void;
}) {
  const { t } = useLanguage();
  const ui = unitInfo(p, "pcs");
  const isService = p.category === "service";
  const out = !isService && p.stock <= 0;
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border border-border text-left transition-colors ${out ? "opacity-50" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs sm:text-sm text-foreground truncate">{p.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{p.generic_name}</p>
        {isService
          ? <Badge variant="outline" className="text-[9px] mt-0.5">{t("sales_service")}</Badge>
          : <Badge variant={p.stock === 0 ? "destructive" : p.stock < 20 ? "outline" : "secondary"} className="text-[9px] mt-0.5">{p.stock} {t("sales_pcs_short")}</Badge>}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={out} onClick={() => onAdd(p, "pcs")}>
          {t("sales_pcs")} ৳{ui.prices.pcs.toFixed(0)}
        </Button>
        {!isService && ui.prices.leaf > 0 && ui.pcsPer.leaf > 1 && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={out} onClick={() => onAdd(p, "leaf")}>
            {t("sales_leaf")} ৳{ui.prices.leaf.toFixed(0)}
          </Button>
        )}
        {!isService && ui.prices.box > 0 && ui.pcsPer.box > 1 && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={out} onClick={() => onAdd(p, "box")}>
            {t("sales_box")} ৳{ui.prices.box.toFixed(0)}
          </Button>
        )}
      </div>
    </div>
  );
});

const Sales = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [includeVat, setIncludeVat] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "medicine" | "service">("all");
  const printRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  // Mirrors the latest cart synchronously so rapid scanner events never lose an add.
  const cartRef = useRef<CartItem[]>([]);
  const tRef = useRef(t);
  tRef.current = t;
  const commitCart = (next: CartItem[]) => { cartRef.current = next; setCart(next); };

  // Debounce the search box → server query at most every 300ms.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Server-side product lookup: search text + medicine/service tab filter.
  useEffect(() => {
    setSearchingProducts(true);
    const opts: { category?: string; excludeCategory?: string; search?: string } = {};
    if (activeTab === "service") opts.category = "service";
    else if (activeTab === "medicine") opts.excludeCategory = "service";
    if (search) opts.search = search;
    api.products.list({ ...opts, limit: 40 })
      .then((data) => setProducts(data as any[]))
      .catch(() => {})
      .finally(() => setSearchingProducts(false));
  }, [search, activeTab]);

  // Latest lookup fn for the global scanner listeners (avoids stale closures).
  const lookupRef = useRef<(code: string) => Promise<any>>(async () => null);
  const addToCartRef = useRef<(product: any) => void>(() => {});
  lookupRef.current = async (code: string) => {
    try {
      const rows = await api.products.list({ search: code, limit: 10 });
      return (rows as any[]).find((p) => p.batch_number === code || String(p.id).startsWith(code)) || null;
    } catch {
      return null;
    }
  };

  // USB barcode scanner detection
  useEffect(() => {
    let buffer = "";
    let timer: any;
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (document.activeElement === searchRef.current) return;
      if (e.key === "Enter" && buffer.length > 3) {
        const code = buffer;
        buffer = "";
        const found = await lookupRef.current(code);
        if (found) addToCartRef.current(found);
        else toast.error(tRef.current("sales_not_found") + ": " + code);
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buffer = ""; }, 200);
      }
    };
    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, []);

  const startCameraScanner = async () => {
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      scanStreamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "code_93", "codabar", "itf", "upc_a", "upc_e"]
        });
        const scanLoop = async () => {
          if (!videoRef.current || !scanStreamRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              for (const barcode of barcodes) {
                const code = barcode.rawValue;
                const found = await lookupRef.current(code);
                if (found) { addToCartRef.current(found); toast.success(`${tRef.current("sales_scanned")}: ${found.name}`); }
                else toast.error(tRef.current("sales_not_found") + ": " + code);
              }
              stopScanner();
              return;
            }
          } catch { /* ignore */ }
          if (scanStreamRef.current) requestAnimationFrame(scanLoop);
        };
        setTimeout(scanLoop, 500);
      } else {
        toast.info(t("sales_camera_unavailable"));
      }
    } catch {
      toast.error(t("sales_camera_denied"));
      setScannerOpen(false);
    }
  };

  const stopScanner = () => {
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(t => t.stop());
      scanStreamRef.current = null;
    }
    setScannerOpen(false);
  };

  const filtered = products;

  const addToCart = (product: any, unit: Unit = "pcs") => {
    const { price, pcs_each, prices, pcsPer } = unitInfo(product, unit);
    const lineId = product.id + ":" + unit;
    const current = cartRef.current;
    if (product.category !== "service") {
      const reserved = current.reduce((s, i) => (i.productId === product.id ? s + i.qty * i.pcs_each : s), 0);
      if (reserved + pcs_each > (product.stock || 0)) { toast.error(t("sales_not_enough_stock")); return; }
    }
    const existing = current.find((i) => i.id === lineId);
    const next = existing
      ? current.map((i) => (i.id === lineId ? { ...i, qty: i.qty + 1 } : i))
      : [...current, { id: lineId, productId: product.id, name: product.name, price, qty: 1, pcs_each, unit, category: product.category, prices, pcsPer }];
    commitCart(next);
  };
  addToCartRef.current = addToCart;

  // Stable identity so memoized ProductRow instances don't re-render on cart updates.
  const handleAdd = useCallback((p: any, unit: Unit) => addToCartRef.current(p, unit), []);

  const updateQty = (id: string, delta: number) => {
    commitCart(
      cartRef.current
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeLine = (id: string) => commitCart(cartRef.current.filter((i) => i.id !== id));

  // Switch the unit of an existing cart line (re-prices and re-converts pcs).
  const changeUnit = (item: CartItem, unit: Unit) => {
    if (unit === item.unit) return;
    const newId = item.productId + ":" + unit;
    const current = cartRef.current;
    const other = current.filter((i) => i.id !== item.id);
    const merged = other.find((i) => i.id === newId);
    const qty = item.qty + (merged?.qty || 0);
    const base = other.filter((i) => i.id !== newId);
    const { price, pcs_each, prices, pcsPer } = unitInfo(
      { price: item.prices.pcs, price_leaf: item.prices.leaf, price_box: item.prices.box, pcs_per_leaf: item.pcsPer.leaf, leaves_per_box: item.pcsPer.box / item.pcsPer.leaf },
      unit
    );
    commitCart([...base, { id: newId, productId: item.productId, name: item.name, price, qty, pcs_each, unit, category: item.category, prices, pcsPer }]);
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const vatAmount = includeVat ? (subtotal - discount) * 0.05 : 0;
  const total = subtotal - discount + vatAmount;

  const handleCompleteSale = async () => {
    if (cart.length === 0) { toast.error(t("sales_cart_empty")); return; }
    if (!user) { toast.error(t("sales_login_required")); return; }
    setLoading(true);

    const invoiceNumber = "INV-" + Date.now().toString(36).toUpperCase();
    const items = cart.map((i) => ({
      name: i.name,
      qty: i.qty,
      unit: i.unit,
      price: i.price,
      total: i.price * i.qty,
      ...(i.category !== "service" ? { id: i.productId, qty_pcs: i.qty * i.pcs_each } : {}),
    }));

    try {
      await api.sales.create({
        invoice_number: invoiceNumber,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        items,
        subtotal,
        discount,
        vat: vatAmount,
        total,
        payment_method: paymentMethod,
      });
    } catch (e: any) {
      toast.error(t("sales_failed") + ": " + (e.message || "Unknown error"));
      setLoading(false);
      return;
    }

    setLastInvoice({ invoiceNumber, date: new Date().toLocaleDateString("en-GB"), customerName, customerPhone, items, subtotal, discount, vat: vatAmount, total, paymentMethod });
    toast.success(`${t("sales_completed")}: ${invoiceNumber}`);
    commitCart([]); setDiscount(0); setCustomerName("Walk-in Customer"); setCustomerPhone(""); setLoading(false);
    fetchProducts();
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Invoice</title><style>
      body{margin:0;padding:2mm;font-family:'Courier New',monospace;font-size:9pt;width:72mm}
      table{width:100%;border-collapse:collapse}
      th,td{padding:1px 0;text-align:left}
      .hidden{display:none}
      @media print{@page{margin:0;size:72mm auto}body{margin:0;padding:2mm;font-size:9pt}}
    </style></head><body>`);
    printWindow.document.write(printRef.current.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">{t("sales_title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("sales_subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={startCameraScanner}>
            <Camera className="h-4 w-4" /> <span className="hidden sm:inline">{t("sales_scan_camera")}</span><span className="sm:hidden">{t("sales_scan_camera")}</span>
          </Button>
          <UserManual page="pos" />
        </div>
      </div>

      <Dialog open={scannerOpen} onOpenChange={(o) => { if (!o) stopScanner(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> {t("scan_camera_title")}</DialogTitle></DialogHeader>
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 border-2 border-primary rounded-lg animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">{t("scan_point")}</p>
          <Button variant="outline" onClick={stopScanner}>{t("scan_close")}</Button>
        </DialogContent>
      </Dialog>

      <div className="flex gap-1.5 overflow-x-auto">
        {(["all", "medicine", "service"] as const).map(tab => (
          <Button key={tab} variant={activeTab === tab ? "default" : "outline"} size="sm" className="text-xs h-8 shrink-0" onClick={() => setActiveTab(tab)}>
            {tab === "all" ? t("sales_all") : tab === "medicine" ? t("sales_medicines") : t("sales_services")}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} placeholder={t("sales_search_ph")} className="pl-9 h-9 text-sm" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <p className="text-[10px] text-muted-foreground">{t("sales_scanner_hint")}</p>
          <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
            {searchingProducts ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <p className="col-span-full py-8 text-center text-xs text-muted-foreground">{t("sales_no_products")}</p>
            ) : filtered.map((p) => (
              <ProductRow key={p.id} product={p} onAdd={handleAdd} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> {t("sales_cart")} ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 sm:px-6">
              <div className="grid grid-cols-2 gap-1.5">
                <Input placeholder={t("sales_customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="text-xs h-8" />
                <Input placeholder={t("sales_phone")} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="text-xs h-8" />
              </div>

              <div className="space-y-1.5 max-h-36 sm:max-h-48 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-4">{t("sales_add_hint")}</p>
                ) : cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 text-xs">
                    <span className="flex-1 truncate">
                      {item.name}
                      <span className="text-[10px] text-muted-foreground"> · ৳{item.price.toFixed(0)}/{(item.unit === "box" ? t("sales_box") : item.unit === "leaf" ? t("sales_leaf") : t("sales_pcs"))}</span>
                    </span>
                    {item.category !== "service" && item.pcsPer.box > 1 ? (
                      <select
                        value={item.unit}
                        onChange={(e) => changeUnit(item, e.target.value as Unit)}
                        className="h-6 text-[10px] rounded border border-border bg-background px-0.5"
                      >
                        <option value="pcs">{t("sales_pcs")}</option>
                        {item.pcsPer.leaf > 1 && <option value="leaf">{t("sales_leaf")}</option>}
                        {item.pcsPer.box > 1 && <option value="box">{t("sales_box")}</option>}
                      </select>
                    ) : (
                      <span className="text-[10px] text-muted-foreground uppercase">{item.unit}</span>
                    )}
                    <div className="flex items-center gap-0.5">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-5 text-center font-medium">{item.qty}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="w-14 text-right font-medium">৳{(item.price * item.qty).toFixed(0)}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeLine(item.id)}><X className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>{t("sales_subtotal")}</span><span>৳{subtotal.toFixed(2)}</span></div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t("sales_discount")}</span>
                  <Input type="number" min={0} className="w-20 h-6 text-[11px] text-right" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={includeVat} onChange={(e) => setIncludeVat(e.target.checked)} className="rounded" />
                    <span>{t("sales_vat_label")}</span>
                  </label>
                  <span>৳{vatAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base sm:text-lg">
                  <span>{t("total")}</span>
                  <span className="text-primary">৳{total.toFixed(2)}</span>
                </div>
              </div>

              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("sales_cash")}</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="card">{t("sales_card")}</SelectItem>
                </SelectContent>
              </Select>

              <Button className="w-full h-10" onClick={handleCompleteSale} disabled={loading || cart.length === 0}>
                {loading ? t("sales_processing") : t("sales_complete")}
              </Button>

              {lastInvoice && (
                <Button variant="outline" className="w-full gap-2 text-xs" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> {t("sales_print_receipt_72")}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {lastInvoice && (
        <div className="hidden">
          <InvoicePrint ref={printRef} {...lastInvoice} />
        </div>
      )}
    </div>
  );
};
export default Sales;
