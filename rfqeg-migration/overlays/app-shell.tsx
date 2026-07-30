"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileStack, Settings, Network, LogOut, Building2, Truck, Sheet } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMe } from "@/hooks/useAuth";
import { api } from "@/lib/api-client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rfqs", label: "RFQs", icon: FileStack },
  { href: "/funnel", label: "Funnel", icon: Sheet, salesOnly: true },
  { href: "/partners", label: "Partners", icon: Building2, salesOnly: true },
  { href: "/suppliers", label: "Suppliers", icon: Truck, salesOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, salesOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useMe();

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/50 p-4 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Network className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">RFQ Portal</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.filter((n) => !n.salesOnly || user?.role === "SALES").map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <n.icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t pt-4">
          <div className="px-2">
            <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
            <Badge variant={user?.role === "SALES" ? "default" : "secondary"} className="mt-1">
              {user?.role === "SALES" ? "Sales (Admin)" : "Presales / Sourcing"}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Network className="h-5 w-5 text-primary" />
            <span className="font-semibold">RFQ Portal</span>
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            {NAV.find((n) => pathname.startsWith(n.href))?.label}
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-x-hidden p-4 pb-20 md:p-6 md:pb-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background/95 backdrop-blur-xl md:hidden">
          {NAV.filter((n) => !n.salesOnly || user?.role === "SALES").slice(0, 5).map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}
