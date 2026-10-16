import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, QrCode, Search, Download, Printer, Barcode } from "lucide-react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import QRCode from "qrcode";
import { BarcodeGenerator } from "@/components/BarcodeGenerator";

const QrScanner = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState("scan");
  const [scanResult, setScanResult] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [genQuery, setGenQuery] = useState("");
  const [bulkQuery, setBulkQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkQRs, setBulkQRs] = useState<Map<string, string>>(new Map());
  const scannerRef = useRef<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Server-side lookup (never pull the full 22k catalog into this page)
  const searchProducts = async (q: string, limit = 30) => {
    const query = q.trim();
    if (query.length < 2) { setProducts([]); return []; }
    setSearching(true);
    try {
      const res = await api.products.list({ search: query, limit });
      setProducts(res as any[]);
      return res as any[];
    } catch {
      toast.error(t("qr_search_failed"));
      return [];
    } finally {
      setSearching(false);
    }
  };

  const findProduct = (searchVal: string) => {
    const lower = searchVal.toLowerCase();
    return products.find(
      (p) =>
        p.batch_number === searchVal ||
        p.id === searchVal ||
        String(p.name).toLowerCase().includes(lower)
    );
  };

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        async (decodedText) => {
          setScanResult(decodedText);
          await scanner.stop();
          setScanning(false);
          // Try JSON parse for QR, or plain text for barcode
          let searchVal = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            searchVal = parsed.id || parsed.batch || decodedText;
          } catch {}
          const results = await searchProducts(searchVal, 10);
          const found = results[0] ?? findProduct(searchVal);
          setProduct(found || null);
          if (found) toast.success(t("qr_found") + ": " + found.name);
          else toast.info(t("qr_not_found_coded") + " " + decodedText);
        },
        () => {}
      );
    } catch (e: any) {
      toast.error(t("qr_camera_failed") + ": " + e.message);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      setScanning(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualSearch.trim()) return;
    const results = await searchProducts(manualSearch.trim(), 20);
    const found = results[0] ?? findProduct(manualSearch.trim());
    if (found) {
      setProduct(found);
      setScanResult(found.batch_number || found.id);
    } else {
      toast.error(t("sales_not_found"));
      setProduct(null);
    }
  };

  const generateQR = async (p: any) => {
    setSelectedProduct(p);
    const data = JSON.stringify({ id: p.id, name: p.name, batch: p.batch_number, price: p.price });
    const url = await QRCode.toDataURL(data, { width: 256, margin: 2 });
    setQrDataUrl(url);
  };

  const downloadQR = () => {
    if (!qrDataUrl || !selectedProduct) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR-${selectedProduct.name.replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const toggleBulkSelect = (id: string) => {
    const next = new Set(bulkSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setBulkSelected(next);
  };

  const generateBulkQRs = async () => {
    if (bulkSelected.size > 50) { toast.error(t("qr_max_bulk")); return; }
    const map = new Map<string, string>();
    for (const id of bulkSelected) {
      const p = products.find((pr) => pr.id === id);
      if (!p) continue;
      const data = JSON.stringify({ id: p.id, name: p.name, batch: p.batch_number, price: p.price });
      const url = await QRCode.toDataURL(data, { width: 200, margin: 1 });
      map.set(id, url);
    }
    setBulkQRs(map);
  };

  const printBulkQRs = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>QR Codes</title><style>
      body{margin:0;padding:10px;font-family:sans-serif;font-size:8pt}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      .item{border:1px solid #ddd;padding:6px;text-align:center;page-break-inside:avoid}
      .item img{width:100px;height:100px}
      .item p{margin:2px 0}
      @media print{@page{margin:3mm}.grid{grid-template-columns:repeat(4,1fr)!important}}
    </style></head><body>`);
    w.document.write(printRef.current.innerHTML);
    w.document.write("</body></html>");
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("qr_title")}</h1>
        <p className="text-muted-foreground">{t("qr_subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="scan"><Camera className="mr-1 h-4 w-4" /> {t("qr_scan_tab")}</TabsTrigger>
          <TabsTrigger value="generate"><QrCode className="mr-1 h-4 w-4" /> {t("qr_qr_generate")}</TabsTrigger>
          <TabsTrigger value="bulk"><Printer className="mr-1 h-4 w-4" /> {t("qr_bulk_print")}</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>{t("qr_camera_title")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">{t("qr_hint")}</p>
              <div id="qr-reader" className="w-full max-w-md mx-auto rounded-lg overflow-hidden" />
              <div className="flex gap-2 justify-center">
                {!scanning ? (
                  <Button onClick={startScanner}><Camera className="mr-2 h-4 w-4" /> {t("qr_start")}</Button>
                ) : (
                  <Button variant="destructive" onClick={stopScanner}>{t("qr_stop")}</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("qr_manual")}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder={t("qr_manual_ph")} value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()} />
                <Button onClick={handleManualSearch}><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {product && (
            <Card>
              <CardHeader><CardTitle>{t("qr_product_found")}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">{t("prod_name")}</p><p className="font-medium">{product.name}</p></div>
                  <div><p className="text-muted-foreground text-xs">{t("prod_generic")}</p><p>{product.generic_name}</p></div>
                  <div><p className="text-muted-foreground text-xs">{t("price")}</p><p className="font-bold text-primary">৳{Number(product.price).toFixed(2)}</p></div>
                  <div><p className="text-muted-foreground text-xs">{t("prod_stock")}</p>
                    <Badge variant={product.stock === 0 ? "destructive" : product.stock < product.min_stock ? "outline" : "secondary"}>{product.stock}</Badge>
                  </div>
                  <div><p className="text-muted-foreground text-xs">{t("prod_batch")}</p><p className="font-mono">{product.batch_number}</p></div>
                  <div><p className="text-muted-foreground text-xs">{t("prod_expiry")}</p><p>{product.expiry_date || t("qr_na")}</p></div>
                </div>
                <div className="mt-3">
                  <BarcodeGenerator value={product.batch_number || String(product.id).slice(0, 12)} height={40} />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="generate" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>{t("qr_generate")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("qr_generate_hint")}</p>
              <div className="flex gap-2">
                <Input placeholder={t("qr_type_search")} value={genQuery}
                  onChange={(e) => { setGenQuery(e.target.value); searchProducts(e.target.value, 30); }}
                  onKeyDown={(e) => e.key === "Enter" && searchProducts(genQuery, 30)} />
                <Button onClick={() => searchProducts(genQuery, 30)} disabled={searching}><Search className="h-4 w-4" /></Button>
              </div>
              {searching && <p className="text-xs text-muted-foreground">{t("po_searching")}</p>}
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {products.length === 0 && !searching && (
                  <p className="text-xs text-muted-foreground py-4 text-center">{t("qr_no_results")}</p>
                )}
                {products.slice(0, 30).map((p) => (
                  <button key={p.id} onClick={() => generateQR(p)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${selectedProduct?.id === p.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.batch_number || t("qr_no_batch")}</p>
                    </div>
                    <span className="text-sm font-bold text-primary">৳{Number(p.price).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {qrDataUrl && selectedProduct && (
            <Card>
              <CardContent className="pt-6 flex flex-col items-center gap-4">
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-lg border border-border" />
                <p className="font-medium">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedProduct.batch_number}</p>
                <div className="flex gap-2">
                  <Button onClick={downloadQR}><Download className="mr-2 h-4 w-4" /> {t("qr_download")}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>{t("qr_bulk")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder={t("qr_bulk_search_ph")} value={bulkQuery}
                  onChange={(e) => { setBulkQuery(e.target.value); searchProducts(e.target.value, 50); }}
                  onKeyDown={(e) => e.key === "Enter" && searchProducts(bulkQuery, 50)} />
                <Button onClick={() => searchProducts(bulkQuery, 50)} disabled={searching}><Search className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={products.length > 0 && bulkSelected.size === products.length}
                  onCheckedChange={() => {
                    if (bulkSelected.size === products.length) setBulkSelected(new Set());
                    else setBulkSelected(new Set(products.map((p) => p.id)));
                  }} />
                <span className="text-sm font-medium">{t("qr_select_shown")} ({bulkSelected.size}/{products.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {products.length === 0 && !searching && (
                  <p className="col-span-full text-xs text-muted-foreground py-4 text-center">{t("qr_bulk_empty")}</p>
                )}
                {products.slice(0, 50).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer text-xs hover:bg-accent/50">
                    <Checkbox checked={bulkSelected.has(p.id)} onCheckedChange={() => toggleBulkSelect(p.id)} />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={generateBulkQRs} disabled={bulkSelected.size === 0}>
                  <QrCode className="mr-2 h-4 w-4" /> {t("qr_generate")} {bulkSelected.size} {t("qr_codes")}
                </Button>
                {bulkQRs.size > 0 && (
                  <Button variant="outline" onClick={printBulkQRs}>
                    <Printer className="mr-2 h-4 w-4" /> {t("qr_print_all")}
                  </Button>
                )}
              </div>

              {bulkQRs.size > 0 && (
                <div ref={printRef}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
                    {Array.from(bulkQRs.entries()).map(([id, url]) => {
                      const p = products.find((pr) => pr.id === id);
                      return (
                        <div key={id} className="item" style={{ border: "1px solid #ddd", padding: "6px", textAlign: "center" }}>
                          <img src={url} alt="QR" style={{ width: "100px", height: "100px", margin: "0 auto" }} />
                          <p style={{ margin: "2px 0", fontSize: "10px", fontWeight: "bold" }}>{p?.name}</p>
                          <p style={{ margin: "2px 0", fontSize: "9px" }}>৳{Number(p?.price || 0).toFixed(2)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default QrScanner;
