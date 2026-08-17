import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { listOfflineSales, removeOfflineSale } from "@/lib/offlineSalesQueue";

type OfflineSyncContextValue = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncError: string | null;
  refreshPendingCount: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const checkout = trpc.pos.checkout.useMutation();
  const quickCheckout = trpc.pos.quickCheckout.useMutation();
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount((await listOfflineSales()).length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine || !isAuthenticated || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const queued = await listOfflineSales();
      if (!queued.length) {
        setPendingCount(0);
        return;
      }
      let completed = 0;
      for (const record of queued) {
        try {
          if (record.kind === "checkout") await checkout.mutateAsync(record.input as Parameters<typeof checkout.mutateAsync>[0]);
          else await quickCheckout.mutateAsync(record.input as Parameters<typeof quickCheckout.mutateAsync>[0]);
          await removeOfflineSale(record.clientReference);
          completed += 1;
          setPendingCount(current => Math.max(0, current - 1));
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : "A queued sale could not be synchronized yet.");
          break;
        }
      }
      await refreshPendingCount();
      if (completed) {
        await Promise.all([
          utils.erp.dashboard.invalidate(),
          utils.erp.invoices.list.invalidate(),
          utils.erp.sales.list.invalidate(),
          utils.erp.salesHistory.list.invalidate(),
          utils.erp.salesHistory.monthlyReport.invalidate(),
          utils.erp.inventory.list.invalidate(),
          utils.pos.session.current.invalidate(),
        ]);
        toast.success(`${completed} offline sale${completed === 1 ? "" : "s"} synchronized`);
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [checkout, isAuthenticated, quickCheckout, refreshPendingCount, utils]);

  useEffect(() => {
    void refreshPendingCount();
    const onOnline = () => {
      setIsOnline(true);
      void syncNow();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshPendingCount, syncNow]);

  useEffect(() => {
    void syncNow();
  }, [isAuthenticated, syncNow]);

  const value = useMemo(() => ({ isOnline, pendingCount, isSyncing, syncError, refreshPendingCount, syncNow }), [isOnline, pendingCount, isSyncing, syncError, refreshPendingCount, syncNow]);
  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error("useOfflineSync must be used inside OfflineSyncProvider");
  return context;
}
