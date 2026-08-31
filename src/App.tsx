import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ColorThemeProvider } from "@/components/ColorThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { AuthLoading } from "@/components/AuthLoading";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RoleRoute } from "@/components/RoleRoute";

import Landing from "./pages/Landing";
import EnhancedAuth from "./pages/EnhancedAuth";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Sales = lazy(() => import("./pages/Sales"));
const Purchases = lazy(() => import("./pages/Purchases"));
const QrScanner = lazy(() => import("./pages/QrScanner"));
const Reports = lazy(() => import("./pages/Reports"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CMS = lazy(() => import("./pages/CMS"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Shop = lazy(() => import("./pages/Shop"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const CustomerLedger = lazy(() => import("./pages/CustomerLedger"));
const Profile = lazy(() => import("./pages/Profile"));
const Manufacturers = lazy(() => import("./pages/Manufacturers"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { AnimatedOutlet } from "@/components/AnimatedRoutes";

const queryClient = new QueryClient();

/** Simple loading spinner used as Suspense fallback for lazy-loaded routes. */
const PageLoading = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

/** Public marketing home; signed-in users go to the dashboard. */
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

function ProtectedRoutes() {
  const { user, loading, approvalStatus, signOut } = useAuth();

  if (loading) return <AuthLoading />;

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (approvalStatus === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Account Pending Approval</h2>
          <p className="text-muted-foreground">Your account is awaiting approval from the Super Admin. You will receive access once approved.</p>
          <p className="text-sm text-muted-foreground">Need help? Contact via WhatsApp: <a href="https://wa.me/8801873722228" target="_blank" rel="noopener noreferrer" className="text-primary underline">+8801873722228</a></p>
          <button type="button" onClick={() => signOut()} className="text-sm text-destructive underline">Sign Out</button>
        </div>
      </div>
    );
  }

  if (approvalStatus === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-destructive">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">Your account has been rejected by the Super Admin.</p>
          <p className="text-sm text-muted-foreground">Contact: <a href="https://wa.me/8801873722228" target="_blank" rel="noopener noreferrer" className="text-primary underline">+8801873722228</a></p>
          <button type="button" onClick={() => signOut()} className="text-sm text-destructive underline">Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route element={<AnimatedOutlet />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/products" element={<RoleRoute require="staff"><Products /></RoleRoute>} />
            <Route path="/manufacturers" element={<RoleRoute require="staff"><Manufacturers /></RoleRoute>} />
            <Route path="/inventory" element={<RoleRoute require="staff"><Inventory /></RoleRoute>} />
            <Route path="/sales" element={<RoleRoute require="staff"><Sales /></RoleRoute>} />
            <Route path="/purchases" element={<RoleRoute require="staff"><Purchases /></RoleRoute>} />
            <Route path="/qr-scanner" element={<RoleRoute require="staff"><QrScanner /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute require="staff"><Reports /></RoleRoute>} />
            <Route path="/admin" element={<RoleRoute require="admin"><AdminPanel /></RoleRoute>} />
            <Route path="/admin/orders" element={<RoleRoute require="staff"><AdminOrders /></RoleRoute>} />
            <Route path="/admin/users" element={<RoleRoute require="admin"><UserManagement /></RoleRoute>} />
            <Route path="/admin/customers" element={<RoleRoute require="admin"><CustomerLedger /></RoleRoute>} />
            <Route path="/admin/cms" element={<RoleRoute require="admin"><CMS /></RoleRoute>} />
            <Route path="/settings" element={<RoleRoute require="admin"><SettingsPage /></RoleRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/track-order" element={<OrderTracking />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="medsuite-theme">
      <ColorThemeProvider defaultTheme="emerald" storageKey="medsuite-color-theme">
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <OfflineBanner />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/landing" element={<Navigate to="/" replace />} />
                  <Route path="/auth" element={<EnhancedAuth />} />
                  <Route path="/auth-legacy" element={<Suspense fallback={<PageLoading />}><Auth /></Suspense>} />
                  <Route path="/reset-password" element={<Suspense fallback={<PageLoading />}><ResetPassword /></Suspense>} />
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ColorThemeProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
