import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const Auth = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { toast.error(t("auth_fill_fields")); return; }
    setLoading(true);
    try {
      await api.auth.login(loginEmail, loginPassword);
      await refresh();
      toast.success(t("auth_login_success"));
      navigate("/dashboard");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("auth_login_failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupName || !signupEmail || !signupPassword) { toast.error(t("auth_fill_fields")); return; }
    if (signupPassword.length < 8) { toast.error(t("auth_pw_short")); return; }
    setLoading(true);
    try {
      await api.auth.signup(signupName, signupEmail, signupPassword);
      toast.success(t("auth_signup_success"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("auth_signup_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">eT</div>
          <CardTitle className="text-2xl">Medsuite-eT</CardTitle>
          <CardDescription>{t("auth_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t("auth_login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth_signup")}</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t("auth_email")}</Label>
                <Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder={t("auth_email_ph")} />
              </div>
              <div className="space-y-2">
                <Label>{t("auth_password")}</Label>
                <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? t("auth_signing_in") : t("auth_signin")}
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t("profile_fullname")}</Label>
                <Input value={signupName} onChange={(e) => setSignupName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("auth_email")}</Label>
                <Input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("auth_password")}</Label>
                <Input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleSignup} disabled={loading}>
                {loading ? t("auth_creating") : t("auth_create")}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Button 
        variant="outline" 
        size="sm" 
        className="fixed bottom-6 right-6"
        onClick={() => setShowFeatures(true)}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {t("auth_features_btn")}
      </Button>

      <Dialog open={showFeatures} onOpenChange={setShowFeatures}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("auth_features")}</DialogTitle>
            <DialogDescription>{t("auth_features_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm">💊 {t("auth_f1")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat1")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm">🛒 {t("auth_f2")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat2")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm">📊 {t("auth_f3")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat3")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm">👥 {t("auth_f4")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat4")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm">📱 {t("auth_f5")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat5")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm">🔐 {t("auth_f6")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat6")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm">📦 {t("auth_f7")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat7")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm">🌐 {t("auth_f8")}</h3>
                <p className="text-sm text-muted-foreground">{t("auth_feat8")}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
