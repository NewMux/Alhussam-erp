import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AuthGate from "@/components/AuthGate";
import { ClipboardList, FileText, LayoutDashboard, LogOut, MoreHorizontal, Package, ReceiptText, Scissors, Settings, ShoppingCart, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { clientBrand } from "@/lib/branding";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navigation = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Customers", path: "/customers", icon: Users },
  { label: "Inventory", path: "/inventory", icon: Package },
  { label: "Tailoring orders", path: "/tailoring", icon: Scissors },
  { label: "Point of Sale", path: "/sales", icon: ShoppingCart },
  { label: "Sales history", path: "/sales-history", icon: ReceiptText },
  { label: "Invoices", path: "/invoices", icon: FileText },
  { label: "Staff & Payroll", path: "/team", icon: Users },
  { label: "Shop Settings", path: "/settings", icon: Settings },
  { label: "Audit Trail", path: "/audit", icon: ClipboardList },
];

const mobileNavigation = ["/", "/customers", "/sales", "/tailoring"].map(path => navigation.find(item => item.path === path)!);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const currentPage = navigation.find(item => item.path === location) || navigation.find(item => item.path !== "/" && location.startsWith(item.path));
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const moreItems = navigation.filter(item => !mobileNavigation.some(primary => primary.path === item.path));

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <AuthGate />;

  return <div className="min-h-[100dvh] bg-stone-50">
    <aside className="fixed inset-y-0 hidden w-64 border-r bg-white p-4 lg:block">
      <div className="flex items-center gap-3 px-3 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm">
          <img src={clientBrand.logoSrc} alt={clientBrand.logoAlt} className="h-full w-full object-contain" />
        </div>
        <div><p className="font-semibold">{clientBrand.name}</p><p className="text-xs text-muted-foreground">Tailor ERP</p></div>
      </div>
      <nav className="mt-6 space-y-1" aria-label="Main navigation">
        {navigation.map(item => {
          const Icon = item.icon;
          return <Link key={item.path} href={item.path} aria-current={isActive(item.path) ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(item.path) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" />{item.label}</Link>;
        })}
      </nav>
      <div className="absolute inset-x-4 bottom-4 rounded-xl bg-muted p-3">
        <p className="truncate text-sm font-semibold">{user?.name || "Signed-in user"}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
      </div>
    </aside>

    <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur lg:static lg:ml-64 lg:bg-white lg:px-5 lg:py-4">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm">
            <img src={clientBrand.logoSrc} alt={clientBrand.logoAlt} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{clientBrand.name}</p><p className="truncate text-xs text-muted-foreground">{currentPage?.label || "Tailor ERP"}</p></div>
        </div>
        <p className="ml-auto hidden text-sm text-muted-foreground lg:block">Secure business workspace</p>
        <Button variant="ghost" size="icon" className="ml-auto h-11 w-11 rounded-xl lg:hidden" onClick={() => setMoreOpen(true)} aria-label="Open more navigation"><MoreHorizontal className="h-5 w-5" /></Button>
      </div>
    </header>

    <main className="px-4 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:ml-64 lg:p-8">{children}</main>

    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(31,41,55,0.08)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {mobileNavigation.map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const isPos = item.path === "/sales";
          return <Link key={item.path} href={item.path} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isPos ? "-mt-5 h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30" : active ? "bg-primary/10" : ""}`}><Icon className={isPos ? "h-5 w-5" : "h-4 w-4"} /></span><span className={isPos ? "mt-[-2px]" : ""}>{isPos ? "POS" : item.label === "Tailoring orders" ? "Orders" : item.label}</span></Link>;
        })}
        <button type="button" onClick={() => setMoreOpen(true)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${moreItems.some(item => isActive(item.path)) ? "text-primary" : "text-muted-foreground"}`} aria-label="Open more navigation"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${moreItems.some(item => isActive(item.path)) ? "bg-primary/10" : ""}`}><MoreHorizontal className="h-5 w-5" /></span><span>More</span></button>
      </div>
    </nav>

    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="bottom" className="max-h-[82dvh] rounded-t-[1.75rem] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-muted" />
        <SheetHeader className="px-1 pb-3 pt-2 text-left"><SheetTitle>More workspace tools</SheetTitle><SheetDescription>Open the rest of your tailor business workspace.</SheetDescription></SheetHeader>
        <nav className="grid grid-cols-2 gap-2 overflow-y-auto pb-4" aria-label="More navigation">
          {moreItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return <Link key={item.path} href={item.path} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3.5 text-sm font-semibold transition active:scale-[0.98] ${active ? "border-primary bg-primary text-primary-foreground" : "bg-white text-foreground hover:bg-muted"}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/15" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></span><span className="leading-tight">{item.label}</span></Link>;
          })}
        </nav>
        <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name || "Signed-in user"}</p><p className="truncate text-xs text-muted-foreground">{user?.email || "ERP workspace"}</p></div><Button variant="ghost" size="sm" className="h-10 rounded-xl" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div>
      </SheetContent>
    </Sheet>
  </div>;
}
