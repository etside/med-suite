import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Plus, Minus, Trash2, ArrowRight, Store } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { canonicalCategory, categoryLabel } from "@/data/categories";
import ProductImage from "@/components/ProductImage";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface CartItem {
  product: any;
  qty: number;
}

let globalCart: CartItem[] = [];
const cartListeners: Set<() => void> = new Set();

export function useCart() {
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  const addToCart = (product: any) => {
    const existing = globalCart.find((i) => i.product.id === product.id);
    if (existing) existing.qty += 1;
    else globalCart = [...globalCart, { product, qty: 1 }];
    cartListeners.forEach((l) => l());
    rerender();
    toast.success(`${product.name} added to cart`);
  };

  const updateQty = (productId: string, delta: number) => {
    globalCart = globalCart.map((i) => (i.product.id === productId ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0);
    cartListeners.forEach((l) => l());
    rerender();
  };

  const removeItem = (productId: string) => {
    globalCart = globalCart.filter((i) => i.product.id !== productId);
    cartListeners.forEach((l) => l());
    rerender();
  };

  const clearCart = () => {
    globalCart = [];
    cartListeners.forEach((l) => l());
    rerender();
  };

  return { cart: globalCart, addToCart, updateQty, removeItem, clearCart };
}

export { globalCart };

const Shop = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { cart, addToCart, updateQty, removeItem } = useCart();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<{ id: string; count: number; label: string }[]>([]);
  const [shopEnabled, setShopEnabled] = useState<boolean | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 48;

  // Debounce search box → server query at most every 300ms.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadPage = (offset: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoadingProducts(true);
    Promise.all([
      api.products.list({ category: activeCategory || undefined, search: search || undefined, limit: PAGE_SIZE, offset }),
      api.products.count({ category: activeCategory || undefined, search: search || undefined }),
    ])
      .then(([rows, count]) => {
        setProducts((prev) => (append ? [...prev, ...(rows as any[])] : (rows as any[])));
        setTotal(count);
      })
      .catch(() => {})
      .finally(() => { setLoadingProducts(false); setLoadingMore(false); });
  };

  useEffect(() => {
    api.settings.get().then((data) => setShopEnabled(!!data?.shop_enabled)).catch(() => setShopEnabled(false));
    api.products.categoryCounts()
      .then((rows) => setCategories(rows.slice(0, 18).map((r) => ({ id: r.id, count: r.count, label: categoryLabel(r.id) }))))
      .catch(() => {});
  }, []);

  useEffect(() => { loadPage(0, false); }, [search, activeCategory]);

  // Realtime: refetch first page when tab regains focus so products never look stale.
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") loadPage(0, false); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [search, activeCategory]);

  if (shopEnabled === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!shopEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 px-4">
        <Store className="h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-xl font-bold text-foreground">{t("shop_disabled_title")}</h2>
        <p className="text-muted-foreground max-w-md">{t("shop_disabled_desc")}</p>
      </div>
    );
  }

  const visible = products;
  const active = canonicalCategory(activeCategory);

  const cartTotal = cart.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-primary" />
            <span className="truncate">{t("shop_title")}</span>
          </h1>
          <p className="text-[11px] sm:text-sm text-muted-foreground">{t("shop_subtitle")}</p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative shrink-0 h-9">
              <ShoppingCart className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("shop_view_cart")}</span>
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">{cartCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[85vw] sm:max-w-md">
            <SheetHeader><SheetTitle>{t("shop_your_cart")}</SheetTitle></SheetHeader>
            <div className="mt-4 flex-1 space-y-3 overflow-auto">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">{t("shop_empty_cart")}</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border border-border">
                      {item.product.image_url && (
                        <img src={item.product.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{lang === "bn" ? item.product.name_bn : item.product.name}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">৳{Number(item.product.price).toFixed(2)} × {item.qty}</p>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQty(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-5 text-center text-xs font-medium">{item.qty}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQty(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => removeItem(item.product.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-bold text-base sm:text-lg">
                    <span>{t("sales_total")}</span>
                    <span>৳{cartTotal.toFixed(2)}</span>
                  </div>
                  <Button className="w-full" onClick={() => navigate("/checkout")}>
                    {t("shop_checkout")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("prod_search")} className="pl-9 h-9 sm:h-10 text-sm" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
      </div>

      {/* Categories — counts from the server so filters always match live data */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <Button variant={!activeCategory ? "default" : "outline"} size="sm" className="shrink-0 text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3" onClick={() => setActiveCategory(null)}>{t("cat_all")}</Button>
        {categories.map((cat) => (
          <Button key={cat.id} variant={active === cat.id ? "default" : "outline"} size="sm" className="whitespace-nowrap shrink-0 text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
            onClick={() => setActiveCategory(cat.id === active ? null : cat.id)}>
            {cat.label} <span className="ml-1 opacity-60">({cat.count})</span>
          </Button>
        ))}
      </div>

      {/* Product Grid */}
      {loadingProducts ? (
        <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((product) => {
          const inCart = cart.find((i) => i.product.id === product.id);
          return (
            <Card key={product.id} className="overflow-hidden flex flex-col" style={{ contentVisibility: "auto", containIntrinsicSize: "0 280px" }}>
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <ProductImage src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-1.5 sm:p-3 space-y-1 flex-1 flex flex-col">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[11px] sm:text-sm text-foreground line-clamp-2 leading-tight">
                    {lang === "bn" ? product.name_bn : product.name}
                  </h3>
                  {product.generic_name && (
                    <p className="text-[9px] sm:text-xs text-muted-foreground truncate mt-0.5">{product.generic_name}</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-0.5">
                  <span className="text-xs sm:text-base font-bold text-primary">৳{Number(product.price).toFixed(0)}</span>
                  <Badge variant={product.stock === 0 ? "destructive" : product.stock < 20 ? "outline" : "secondary"} className="text-[8px] sm:text-[10px] px-1 py-0">
                    {product.stock === 0 ? t("shop_out") : product.stock < 20 ? t("shop_low") : t("shop_in")}
                  </Badge>
                </div>
                {product.requires_prescription && (
                  <Badge variant="destructive" className="text-[8px] sm:text-[9px] w-fit">Rx</Badge>
                )}
                {product.stock > 0 && (
                  <div className="mt-auto pt-0.5 sm:pt-1">
                    {inCart ? (
                      <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQty(product.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-5 text-center text-xs font-medium">{inCart.qty}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQty(product.id, 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <Button className="w-full h-7 sm:h-8 text-[10px] sm:text-xs" size="sm" onClick={() => addToCart(product)}>
                        <Plus className="mr-0.5 h-3 w-3" /> {t("shop_add")}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">{t("shop_no_products")}</div>
        )}
      </div>
      )}
      {!loadingProducts && visible.length < total && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" disabled={loadingMore} onClick={() => loadPage(products.length, true)}>
            {loadingMore ? t("loading_data") : `${t("shop_load_more")} (${total - visible.length} ${t("shop_remaining")})`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Shop;
