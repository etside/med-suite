import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const ResetPassword = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState<boolean | null>(null);

  useEffect(() => {
    api.auth.me()
      .then(() => setCanReset(true))
      .catch(() => setCanReset(false));
  }, []);

  const handleReset = async () => {
    if (!password || password.length < 8) { toast.error(t("rp_pw_short")); return; }
    if (password !== confirmPassword) { toast.error(t("rp_pw_mismatch")); return; }
    setLoading(true);
    try {
      await api.auth.updatePassword(password);
      toast.success(t("rp_updated"));
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message || t("rp_failed"));
    }
    setLoading(false);
  };

  if (canReset === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!canReset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 space-y-4">
            <p className="text-muted-foreground">{t("rp_login_required")}</p>
            <Button onClick={() => navigate("/auth")}>{t("rp_back_login")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">M</div>
          <CardTitle>{t("rp_set_new")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("rp_new_pw")}</Label>
            <Input type="password" placeholder={t("rp_min_chars")} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("rp_confirm_pw")}</Label>
            <Input type="password" placeholder={t("rp_confirm_ph")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()} />
          </div>
          <Button className="w-full" onClick={handleReset} disabled={loading}>
            {loading ? t("updating") : t("rp_update_btn")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
export default ResetPassword;
