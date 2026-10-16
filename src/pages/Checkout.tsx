import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "./Shop";
import { CheckCircle2, ArrowLeft, Smartphone, Truck, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type PaymentMethod = "bkash" | "nagad" | "cod";

const Checkout = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, clearCart } = useCart();
  const [step, setStep] = useState<"info" | "payment" | "success">("info");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bkash");
  const [trxId, setTrxId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [bkashNumber, setBkashNumber] = useState("01XXXXXXXXX");
  const [nagadNumber, setNagadNumber] = useState("01XXXXXXXXX");

  useEffect(() => {
    api.settings.get().then((data) => {
      if (data?.bkash_number) setBkashNumber(String(data.bkash_number));
      if (data?.nagad_number) setNagadNumber(String(data.nagad_number));
    }).catch(() => {});
  }, []);

  const subtotal = cart.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const deliveryFee = paymentMethod === "cod" ? 50 : 0;
  const total = subtotal + deliveryFee;

  const handleInfoSubmit = () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error(lang === "bn" ? "সকল তথ্য পূরণ করুন" : "Please fill all fields");
      return;
    }
    setStep("payment");
  };

  const handlePlaceOrder = async () => {
    if (!user) { toast.error(t("checkout_login")); navigate("/auth"); return; }
    if (paymentMethod !== "cod" && !trxId.trim()) {
      toast.error(lang === "bn" ? "ট্রানজেকশন আইডি দিন" : "Please enter Transaction ID");
      return;
    }
    setLoading(true);
    const orderNumber = "ORD-" + Date.now().toString(36).toUpperCase();

    try {
      const order = await api.orders.create({
        order_number: orderNumber,
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        payment_method: paymentMethod,
        payment_status: "pending",
        transaction_id: trxId || null,
        delivery_fee: deliveryFee,
        status: "pending",
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.qty,
          unit_price: Number(item.product.price),
        })),
      });
      setOrderId(String(order.order_number || orderNumber));
      setStep("success");
      clearCart();
    } catch (e: any) {
      toast.error(t("checkout_failed") + ": " + (e.message || "Unknown error"));
    }
    setLoading(false);
    toast.success(t("pay_order_success"));
  };

  if (cart.length === 0 && step !== "success") {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-muted-foreground">{t("shop_empty_cart")}</p>
        <Button onClick={() => navigate("/shop")}><ArrowLeft className="mr-2 h-4 w-4" /> {t("shop_browse")}</Button>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{t("pay_order_success")}</h2>
            <p className="text-muted-foreground text-sm">{t("pay_order_success_msg")}</p>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">{t("pay_order_id")}</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-primary break-all">{orderId}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/track-order")}>{t("order_track")}</Button>
              <Button className="flex-1" onClick={() => navigate("/shop")}>{t("shop_browse")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto px-1">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => step === "info" ? navigate("/shop") : setStep("info")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("pay_title")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">{t("pay_subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("sales_order_summary")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {cart.map((item) => (
            <div key={item.product.id} className="flex justify-between text-sm">
              <span className="truncate mr-2">{lang === "bn" ? item.product.name_bn : item.product.name} × {item.qty}</span>
              <span className="font-medium shrink-0">৳{(Number(item.product.price) * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm"><span>{t("sales_subtotal")}</span><span>৳{subtotal.toFixed(2)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between text-sm"><span>{t("checkout_delivery_fee")}</span><span>৳{deliveryFee.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-lg"><span>{t("sales_total")}</span><span className="text-primary">৳{total.toFixed(2)}</span></div>
        </CardContent>
      </Card>

      {step === "info" && (
        <Card>
          <CardHeader><CardTitle className="text-base sm:text-lg">{t("pay_customer_info")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>{t("pay_name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>{t("pay_phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /></div>
            <div className="space-y-2"><Label>{t("pay_address")}</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          </CardContent>
          <CardFooter><Button className="w-full" onClick={handleInfoSubmit}>{t("next")}</Button></CardFooter>
        </Card>
      )}

      {step === "payment" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base sm:text-lg">{t("pay_select_method")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {([
                  { id: "bkash" as const, label: t("pay_bkash"), icon: Smartphone },
                  { id: "nagad" as const, label: t("pay_nagad"), icon: CreditCard },
                  { id: "cod" as const, label: t("pay_cod"), icon: Truck },
                ]).map((method) => (
                  <Button key={method.id} variant={paymentMethod === method.id ? "default" : "outline"}
                    className="h-auto py-3 sm:py-4 flex-col gap-1.5 sm:gap-2" onClick={() => setPaymentMethod(method.id)}>
                    <method.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span className="text-[10px] sm:text-xs font-medium">{method.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {paymentMethod !== "cod" && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("pay_guide_title")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {paymentMethod === "bkash"
                    ? `Send ৳${total.toFixed(2)} to bKash number ${bkashNumber}`
                    : `Send ৳${total.toFixed(2)} to Nagad number ${nagadNumber}`}
                </p>
                <div className="space-y-2">
                  <Label>{t("pay_trx_id")}</Label>
                  <Input value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder={t("pay_enter_trx")} />
                </div>
              </CardContent>
            </Card>
          )}

          {paymentMethod === "cod" && (
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t("pay_cod_note")}</p></CardContent></Card>
          )}

          <Button className="w-full" onClick={handlePlaceOrder} disabled={loading}>
            {loading ? "Placing order..." : t("pay_place_order")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Checkout;
