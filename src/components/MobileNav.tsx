import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, ShoppingCart, ClipboardCheck, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShopEnabled } from "@/hooks/use-shop-enabled";
import { isNavActive } from "@/lib/navActive";

export function MobileNav() {
  const location = useLocation();
  const { isStaff } = useAuth();
  const { t } = useLanguage();
  const shopEnabled = useShopEnabled();

  const staffItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("nav_home") },
    { href: "/sales", icon: ShoppingCart, label: t("nav_pos") },
    { href: "/admin/orders", icon: ClipboardCheck, label: t("nav_orders") },
    ...(shopEnabled ? [{ href: "/shop", icon: Store, label: t("nav_shop") }] : []),
    { href: "/profile", icon: User, label: t("nav_profile") },
  ];

  const customerItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("nav_home") },
    ...(shopEnabled ? [{ href: "/shop", icon: Store, label: t("nav_shop") }] : []),
    { href: "/track-order", icon: ClipboardCheck, label: t("nav_orders") },
    { href: "/profile", icon: User, label: t("nav_profile") },
  ];

  const items = isStaff ? staffItems : customerItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around py-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isNavActive(location.pathname, item.href);
          return (
            <Link key={item.href} to={item.href}
              className={`flex min-h-11 min-w-[3rem] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2 relative transition-all duration-200 touch-manipulation ${active ? "text-primary scale-105" : "text-muted-foreground hover:text-foreground"}`}>
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
