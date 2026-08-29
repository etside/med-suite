import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, ClipboardList,
  BarChart3, Settings, Shield, Users, QrCode, Sun, Moon, Store, Truck,
  LogOut, ClipboardCheck, BookUser, MessageCircle, User, FileText,
  Building2, Bell, ChevronRight,
} from "lucide-react";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { isNavActive } from "@/lib/navActive";
import { useShopEnabled } from "@/hooks/use-shop-enabled";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const WHATSAPP_HELP =
  "https://wa.me/8801873722228?text=Hi%2C%20I%20need%20help%20with%20Medsuite-eT";

export function AppSidebar() {
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { isStaff, isAdmin, signOut, user } = useAuth();
  const shopEnabled = useShopEnabled();

  const mainNav = isStaff
    ? [
        { title: t("nav_dashboard"), icon: LayoutDashboard, href: "/dashboard" },
        { title: t("nav_sales"), icon: ShoppingCart, href: "/sales" },
        { title: t("nav_products"), icon: Package, href: "/products" },
        { title: t("nav_manufacturers"), icon: Building2, href: "/manufacturers" },
        { title: t("nav_inventory"), icon: Warehouse, href: "/inventory" },
        { title: t("nav_purchases"), icon: ClipboardList, href: "/purchases" },
        { title: t("nav_qr_scanner"), icon: QrCode, href: "/qr-scanner" },
        { title: t("nav_reports"), icon: BarChart3, href: "/reports" },
        { title: t("nav_notifications"), icon: Bell, href: "/notifications" },
      ]
    : [];

  const customerNav = [
    ...(shopEnabled ? [{ title: t("nav_shop"), icon: Store, href: "/shop" }] : []),
    { title: t("order_title"), icon: Truck, href: "/track-order" },
  ];

  const adminNav = isStaff
    ? [
        { title: t("admin_orders"), icon: ClipboardCheck, href: "/admin/orders" },
        ...(isAdmin
          ? [
              { title: t("nav_user_mgmt"), icon: Users, href: "/admin/users" },
              { title: "Customer Ledger", icon: BookUser, href: "/admin/customers" },
              { title: "Content Manager", icon: FileText, href: "/admin/cms" },
              { title: t("nav_admin"), icon: Shield, href: "/admin" },
              { title: t("nav_settings"), icon: Settings, href: "/settings" },
            ]
          : []),
      ]
    : [];

  return (
    <Sidebar className="border-r-0">
      {/* ── Header ─────────────────────────────────────────── */}
      <SidebarHeader className="border-b border-white/10 p-4 bg-sidebar">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          {/* Pill icon */}
          <div className="h-9 w-9 rounded-lg bg-[#F5A623]/20 flex items-center justify-center shrink-0">
            <img src="/logo.svg" alt="" className="h-5 w-5 object-contain" />
          </div>
          <div>
            <h1
              className="text-sm font-bold leading-none text-white"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Med<span className="text-[#F5A623]">Suite eT</span>
            </h1>
            <p className="text-[10px] text-white/40 mt-0.5 leading-none">{t("app_tagline")}</p>
          </div>
        </Link>
      </SidebarHeader>

      {/* ── Nav content ───────────────────────────────────── */}
      <SidebarContent className="bg-sidebar px-2 py-3">
        {/* Main */}
        {mainNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1">
              {t("nav_group_main") || "Main"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNav.map((item) => {
                  const active = isNavActive(location.pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.href}
                          className={[
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "border-l-2 border-[#F5A623] text-[#F5A623] bg-white/5 pl-[10px]"
                              : "border-l-2 border-transparent text-white/60 hover:text-white hover:bg-white/5 pl-[10px]",
                          ].join(" ")}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Customer / Shop */}
        {customerNav.length > 0 && (
          <SidebarGroup className="mt-3">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1">
              {t("nav_group_shop") || "Shop"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {customerNav.map((item) => {
                  const active = isNavActive(location.pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.href}
                          className={[
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "border-l-2 border-[#F5A623] text-[#F5A623] bg-white/5 pl-[10px]"
                              : "border-l-2 border-transparent text-white/60 hover:text-white hover:bg-white/5 pl-[10px]",
                          ].join(" ")}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin */}
        {adminNav.length > 0 && (
          <SidebarGroup className="mt-3">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1">
              {t("nav_group_admin") || "Administration"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => {
                  const active = isNavActive(location.pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.href}
                          className={[
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "border-l-2 border-[#F5A623] text-[#F5A623] bg-white/5 pl-[10px]"
                              : "border-l-2 border-transparent text-white/60 hover:text-white hover:bg-white/5 pl-[10px]",
                          ].join(" ")}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ── Footer ────────────────────────────────────────── */}
      <SidebarFooter className="bg-sidebar border-t border-white/10 p-3 space-y-1">
        {/* User email */}
        {user?.email && (
          <Link
            to="/profile"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors group"
          >
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate flex-1">{user.email}</span>
            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </Link>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-1">
          {/* Language toggle */}
          <div className="flex-1">
            <LanguageToggle compact />
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* PWA install */}
          <PwaInstallButton className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10" compact />
        </div>

        {/* WhatsApp support */}
        <a
          href={WHATSAPP_HELP}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{t("whatsapp_support") || "WhatsApp Support"}</span>
        </a>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span>{t("sign_out") || "Sign out"}</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
