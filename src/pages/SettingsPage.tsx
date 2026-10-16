import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { Store } from "lucide-react";

const SettingsPage = () => {
  const { t } = useLanguage();
  const { isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState<any>({
    pharmacy_name: "", phone: "", email: "", address: "",
    license_number: "", bkash_number: "", nagad_number: "", logo_url: "", shop_enabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.settings.get().then((data) => {
      if (data) {
        setSettingsId(String(data.id));
        setSettings({
          pharmacy_name: String(data.pharmacy_name || ""),
          phone: String(data.phone || ""),
          email: String(data.email || ""),
          address: String(data.address || ""),
          license_number: String(data.license_number || ""),
          bkash_number: String(data.bkash_number || ""),
          nagad_number: String(data.nagad_number || ""),
          logo_url: String(data.logo_url || ""),
          shop_enabled: !!data.shop_enabled,
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settingsId) {
        await api.settings.update({ id: settingsId, ...settings });
      } else {
        const data = await api.settings.create(settings);
        if (data?.id) setSettingsId(data.id);
      }
    } catch (e: any) {
      toast.error(t("settings_save_failed") + ": " + (e.message || ""));
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success(t("settings_saved"));
  };

  const set = (key: string, val: any) => setSettings((s: any) => ({ ...s, [key]: val }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings_title")}</h1>
        <p className="text-muted-foreground">{t("settings_subtitle")}</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-8 text-center">{t("loading_data")}</p>
      ) : (
      <>
      {isSuperAdmin && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> {t("nav_shop")}</CardTitle>
            <CardDescription>{t("settings_shop_visibility_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t("settings_shop_visibility")}</p>
                <p className="text-xs text-muted-foreground">{t("settings_shop_visibility_hint")}</p>
              </div>
              <Switch checked={settings.shop_enabled} onCheckedChange={(v) => set("shop_enabled", v)} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("settings_branding")}</CardTitle><CardDescription>{t("settings_branding_desc")}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <ImageUpload currentUrl={settings.logo_url} onUploaded={(url) => set("logo_url", url)} />
            <div>
              <p className="font-medium">{settings.pharmacy_name || t("settings_your_pharmacy")}</p>
              <p className="text-sm text-muted-foreground">{t("settings_logo_hint")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings_pharmacy_info")}</CardTitle><CardDescription>{t("settings_pharmacy_desc")}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("settings_name")}</Label><Input value={settings.pharmacy_name} onChange={(e) => set("pharmacy_name", e.target.value)} /></div>
            <div className="space-y-2"><Label>{t("settings_license")}</Label><Input value={settings.license_number} onChange={(e) => set("license_number", e.target.value)} placeholder={t("settings_license_ph")} /></div>
            <div className="space-y-2"><Label>{t("settings_phone")}</Label><Input value={settings.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="space-y-2"><Label>{t("settings_email")}</Label><Input value={settings.email} onChange={(e) => set("email", e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{t("settings_address")}</Label><Input value={settings.address} onChange={(e) => set("address", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings_bkash_title")}</CardTitle><CardDescription>{t("settings_bkash_desc")}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("settings_bkash_number")}</Label><Input value={settings.bkash_number} onChange={(e) => set("bkash_number", e.target.value)} placeholder={t("settings_phone_ph")} /></div>
            <div className="space-y-2"><Label>{t("settings_nagad_number")}</Label><Input value={settings.nagad_number} onChange={(e) => set("nagad_number", e.target.value)} placeholder={t("settings_phone_ph")} /></div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">{saving ? "Saving..." : t("save")}</Button>
      </>
      )}
    </div>
  );
};
export default SettingsPage;
