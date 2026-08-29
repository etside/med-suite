import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { features } from "@/config/features";
import { getPlatformAssertion, isWebAuthnSupported } from "@/lib/webauthn";
import { Fingerprint, Lock, Eye, EyeOff, Loader2, ArrowLeft, Check } from "lucide-react";

const EnhancedAuth = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [authMode, setAuthMode] = useState<"password" | "pin" | "biometric">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [supportsBiometric, setSupportsBiometric] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState<boolean | null>(null);

  const tabCount = 1 + (features.pinAuth ? 1 : 0) + (supportsBiometric ? 1 : 0);

  useEffect(() => {
    setSupportsBiometric(isWebAuthnSupported());
  }, []);

  useEffect(() => {
    if (!supportsBiometric || !email.trim()) {
      setBiometricEnrolled(null);
      return;
    }
    let cancelled = false;
    api.auth
      .biometricStatus(email)
      .then((s) => {
        if (!cancelled) setBiometricEnrolled(s.enrolled);
      })
      .catch(() => {
        if (!cancelled) setBiometricEnrolled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, supportsBiometric]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password, { method: "password" });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePINLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email, pin, { method: "pin" });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "PIN authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!supportsBiometric) {
      setError("Biometric login requires HTTPS (or localhost) and a supported device");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const loginOptions = await api.auth.webauthnLoginOptions(email);
      const credential = await getPlatformAssertion(loginOptions);
      await signIn(email, "", { method: "biometric", credential });
      navigate("/dashboard");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Biometric authentication failed";
      setError(msg);
      if (import.meta.env.DEV) console.error("[Biometric login]", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left panel (desktop only) ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#1E3A5F] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/3 rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="h-10 w-10 rounded-xl bg-[#F5A623]/20 flex items-center justify-center">
              <img src="/logo.svg" alt="" className="h-6 w-6 object-contain" />
            </div>
            <span
              className="font-bold text-white text-lg"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Med<span className="text-[#F5A623]">Suite eT</span>
            </span>
          </div>

          {/* Headline */}
          <h2
            className="text-3xl font-bold text-white leading-snug mb-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Pharmacy management<br />built for the front line.
          </h2>
          <p className="text-white/50 text-sm mb-10 leading-relaxed">
            Sign in to your workspace and keep your pharmacy running with confidence.
          </p>

          {/* Bullet points */}
          <ul className="space-y-4">
            {[
              "Real-time stock tracking across all products",
              "4-second checkout with barcode scanning",
              "Staff roles, audit trails, and secure access",
            ].map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#F5A623]/15">
                  <Check className="h-3 w-3 text-[#F5A623]" />
                </span>
                <span className="text-white/70 text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer tag */}
        <div className="relative text-white/20 text-xs">
          © 2026 Medsuite-eT · engineersTech
        </div>
      </div>

      {/* ── Right panel: form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950">
        {/* Mobile: navy bar */}
        <div className="lg:hidden flex items-center gap-3 bg-[#1E3A5F] px-5 py-4">
          <div className="h-8 w-8 rounded-lg bg-[#F5A623]/20 flex items-center justify-center">
            <img src="/logo.svg" alt="" className="h-5 w-5 object-contain" />
          </div>
          <span
            className="font-bold text-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Med<span className="text-[#F5A623]">Suite eT</span>
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-24 max-w-lg lg:max-w-none mx-auto w-full">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-8 w-fit transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </button>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <h1
              className="text-2xl font-bold text-slate-900 dark:text-white mb-1"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Sign in to your account
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              Welcome back. Enter your credentials below.
            </p>

            {/* Auth mode tabs */}
            <Tabs
              value={authMode}
              onValueChange={(v) => { setAuthMode(v as typeof authMode); setError(""); }}
              className="w-full"
            >
              {tabCount > 1 && (
                <TabsList
                  className="mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1"
                  style={{ display: "grid", gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}
                >
                  <TabsTrigger
                    value="password"
                    className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 text-xs"
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Password
                  </TabsTrigger>
                  {features.pinAuth && (
                    <TabsTrigger
                      value="pin"
                      className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 text-xs"
                    >
                      🔐 PIN
                    </TabsTrigger>
                  )}
                  {supportsBiometric && (
                    <TabsTrigger
                      value="biometric"
                      className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 text-xs"
                    >
                      <Fingerprint className="h-3.5 w-3.5 mr-1.5" />
                      Biometric
                    </TabsTrigger>
                  )}
                </TabsList>
              )}

              {/* ── Password tab ── */}
              <TabsContent value="password" className="mt-0">
                <form onSubmit={handlePasswordLogin} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@pharmacy.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-[#1E3A5F] dark:focus:border-[#F5A623]"
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Password
                      </Label>
                      <button
                        type="button"
                        className="text-xs text-[#1E3A5F] dark:text-[#F5A623] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-[#1E3A5F] dark:focus:border-[#F5A623] pr-10"
                        disabled={loading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <ErrorBanner message={error} />}

                  <Button
                    type="submit"
                    className="w-full h-10 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-semibold"
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in…</>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* ── PIN tab ── */}
              <TabsContent value="pin" className="mt-0">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                  Enter your 4-digit PIN for quick access.
                </p>
                <form onSubmit={handlePINLogin} className="space-y-5">
                  {/* PIN dots display */}
                  <div className="flex gap-3 justify-center my-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={[
                          "h-12 w-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-colors",
                          pin.length > i
                            ? "border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F] dark:border-[#F5A623] dark:text-[#F5A623]"
                            : "border-slate-200 dark:border-slate-700",
                        ].join(" ")}
                      >
                        {pin.length > i ? "•" : ""}
                      </div>
                    ))}
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => pin.length < 4 && setPin(pin + num)}
                        className="h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-white hover:border-[#1E3A5F] dark:hover:border-[#F5A623] transition-colors"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => pin.length < 4 && setPin(pin + "0")}
                      className="col-span-2 h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-white hover:border-[#1E3A5F] dark:hover:border-[#F5A623] transition-colors"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setPin(pin.slice(0, -1))}
                      className="h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-500 hover:text-red-500 transition-colors"
                    >
                      ⌫
                    </button>
                  </div>

                  {error && <ErrorBanner message={error} />}

                  <Button
                    type="submit"
                    className="w-full h-10 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-semibold"
                    disabled={pin.length !== 4 || loading}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</>
                    ) : (
                      "Unlock"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* ── Biometric tab ── */}
              {supportsBiometric && (
                <TabsContent value="biometric" className="mt-0">
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="bio-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Email address
                      </Label>
                      <Input
                        id="bio-email"
                        type="email"
                        placeholder="you@pharmacy.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-[#1E3A5F]"
                        disabled={loading}
                      />
                    </div>

                    <div className="flex justify-center py-4">
                      <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2.2, repeat: Infinity }}
                        className="h-20 w-20 rounded-full bg-[#1E3A5F]/10 dark:bg-[#1E3A5F]/30 flex items-center justify-center"
                      >
                        <Fingerprint className="h-10 w-10 text-[#1E3A5F] dark:text-blue-300" />
                      </motion.div>
                    </div>

                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                      {biometricEnrolled === false
                        ? "Enable biometrics in Profile → Biometric Authentication after signing in with your password."
                        : biometricEnrolled === true
                          ? "Use fingerprint or Face ID to authenticate."
                          : "Checking enrollment…"}
                    </p>

                    {error && <ErrorBanner message={error} />}

                    <Button
                      onClick={handleBiometricLogin}
                      className="w-full h-10 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-semibold"
                      disabled={loading || !email.trim() || biometricEnrolled === false}
                    >
                      {loading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Authenticating…</>
                      ) : (
                        <><Fingerprint className="h-4 w-4 mr-2" />Start biometric login</>
                      )}
                    </Button>

                    <button
                      type="button"
                      className="w-full text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors py-1"
                      onClick={() => { setAuthMode("password"); setError(""); }}
                    >
                      Use password instead
                    </button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-sm px-4 py-3"
    >
      {message}
    </motion.div>
  );
}

export default EnhancedAuth;
