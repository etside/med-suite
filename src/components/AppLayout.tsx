import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { MobileNav } from "@/components/MobileNav";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import Footer from "@/components/Footer";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-[hsl(213_52%_14%)] px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-white/70 hover:text-white hover:bg-white/10" />
              <img
                src="/logo.svg"
                alt="MedSuite eT"
                className="h-6 w-6 rounded object-contain sm:hidden"
              />
              <h2 className="font-semibold tracking-tight text-white hidden sm:block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1.1rem" }}>
                Med<span className="text-[#F5A623]">Suite eT</span>
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <ThemeSwitcher className="text-white/70 hover:text-white hover:bg-white/10" />
              <NotificationBell className="text-white/70 hover:text-white hover:bg-white/10" />
            </div>
          </header>
          <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <MobileNav />
    </SidebarProvider>
  );
}
