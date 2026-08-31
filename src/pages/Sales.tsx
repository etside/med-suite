import { useState, useEffect, useRef } from "react";
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

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  category?: string;
}

const Sales = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
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

  const fetchProducts = async () => {
    try {
      const data = await api.products.list();
      setProducts((data as any[]).sort((a, b) => String(a.name).localeCompare(String(b.name))));
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchProducts(); }, []);

  // USB barcode scanner detection
  useEffect(() => {
    let buffer = "";
    let timer: any;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (document.activeElement === searchRef.current) return;
      if (e.key === "Enter" && buffer.length > 3) {
        const found = products.find((p) => p.batch_number === buffer || p.id.startsWith(buffer));
        if (found) addToCart(found);
        else toast.error("Product not found: " + buffer);
        buffer = "";
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
  }, [products, cart]);

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
                const found = products.find((p) => p.batch_number === code || p.id.startsWith(code));
                if (found) { addToCart(found); toast.success(`Scanned: ${found.name}`); }
                else toast.error("Product not found: " + code);
              }
              stopScanner();
              return;
            }
          } catch { /* ignore */ }
          if (scanStreamRef.current) requestAnimationFrame(scanLoop);
        };
        setTimeout(scanLoop, 500);
      } else {
        toast.info("BarcodeDetector API not available. Use a USB scanner instead.");
      }
    } catch {
      toast.error("Camera access denied");
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

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.generic_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.batch_number || "").toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || (activeTab === "service" ? p.category === "service" : p.category !== "service");
    return matchSearch && matchTab;
  });

  const addToCart = (product: any) => {
    const existing = cart.find((i) => i.id === product.id);
    if (existing) {
      if (product.category !== "service" && existing.qty >= product.stock) { toast.error("Not enough stock"); return; }
      setCart(cart.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i)));
    } else {
      if (product.category !== "service" && product.stock <= 0) { toast.error("Out of stock"); return; }
      setCart([...cart, { id: product.id, name: product.name, price: Number(product.price), qty: 1, category: product.category }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const vatAmount = includeVat ? (subtotal - discount) * 0.05 : 0;
  const total = subtotal - discount + vatAmount;

  const handleCompleteSale = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (!user) { toast.error("Login required"); return; }
    setLoading(true);

    const invoiceNumber = "INV-" + Date.now().toString(36).toUpperCase();
    const items = cart.map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      total: i.price * i.qty,
      ...(i.category !== "service" ? { id: i.id } : {}),
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
      toast.error("Sale failed: " + (e.message || "Unknown error"));
      setLoading(false);
      return;
    }

    setLastInvoice({ invoiceNumber, date: new Date().toLocaleDateString("en-GB"), customerName, customerPhone, items, subtotal, discount, vat: vatAmount, total, paymentMethod });
    toast.success(`Sale completed! Invoice: ${invoiceNumber}`);
    setCart([]); setDiscount(0); setCustomerName("Walk-in Customer"); setCustomerPhone(""); setLoading(false);
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
            <Camera className="h-4 w-4" /> <span className="hidden sm:inline">Scan</span> QR/Barcode
          </Button>
          <UserManual page="pos" />
        </div>
      </div>

      <Dialog open={scannerOpen} onOpenChange={(o) => { if (!o) stopScanner(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> Camera Scanner</DialogTitle></DialogHeader>
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 border-2 border-primary rounded-lg animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Point camera at barcode or QR code</p>
          <Button variant="outline" onClick={stopScanner}>Close</Button>
        </DialogContent>
      </Dialog>

      <div className="flex gap-1.5 overflow-x-auto">
        {(["all", "medicine", "service"] as const).map(tab => (
          <Button key={tab} variant={activeTab === tab ? "default" : "outline"} size="sm" className="text-xs h-8 shrink-0" onClick={() => setActiveTab(tab)}>
            {tab === "all" ? "All" : tab === "medicine" ? "Medicines" : "Services"}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Search product or barcode..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="text-[10px] text-muted-foreground">💡 USB scanner auto-detects. Tap camera button for mobile scanning.</p>
          <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
            {filtered.slice(0, 40).map((p) => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-accent/50 text-left transition-colors disabled:opacity-50"
                disabled={p.category !== "service" && p.stock <= 0}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs sm:text-sm text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.generic_name}</p>
                  {p.category === "service" && <Badge variant="outline" className="text-[9px] mt-0.5">Service</Badge>}
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="font-bold text-xs sm:text-sm text-primary">৳{Number(p.price).toFixed(0)}</p>
                  {p.category !== "service" && (
                    <Badge variant={p.stock === 0 ? "destructive" : p.stock < 20 ? "outline" : "secondary"} className="text-[9px]">{p.stock}</Badge>
                  )}
                </div>
              </button>
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
                <Input placeholder="Customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="text-xs h-8" />
                <Input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="text-xs h-8" />
              </div>

              <div className="space-y-1.5 max-h-36 sm:max-h-48 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-4">Scan or search to add items</p>
                ) : cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 text-xs">
                    <span className="flex-1 truncate">{item.name}</span>
                    <div className="flex items-center gap-0.5">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-5 text-center font-medium">{item.qty}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="w-14 text-right font-medium">৳{(item.price * item.qty).toFixed(0)}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setCart(cart.filter((i) => i.id !== item.id))}><X className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Subtotal</span><span>৳{subtotal.toFixed(2)}</span></div>
                <div className="flex items-center justify-between gap-2">
                  <span>Discount</span>
                  <Input type="number" min={0} className="w-20 h-6 text-[11px] text-right" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={includeVat} onChange={(e) => setIncludeVat(e.target.checked)} className="rounded" />
                    <span>VAT 5%</span>
                  </label>
                  <span>৳{vatAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base sm:text-lg">
                  <span>Total</span>
                  <span className="text-primary">৳{total.toFixed(2)}</span>
                </div>
              </div>

              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>

              <Button className="w-full h-10" onClick={handleCompleteSale} disabled={loading || cart.length === 0}>
                {loading ? "Processing..." : t("sales_complete")}
              </Button>

              {lastInvoice && (
                <Button variant="outline" className="w-full gap-2 text-xs" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Print Receipt (72mm Thermal)
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
