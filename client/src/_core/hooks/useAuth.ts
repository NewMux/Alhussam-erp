import { pb } from "@/lib/pocketbase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

type CachedUser = { id: string; name: string | null; email: string | null; role: "user" | "admin" };
const CACHED_USER_KEY = "al-hussam-erp-last-user";

function readCachedUser(): CachedUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CachedUser>;
    if (typeof value.id !== "string" || (value.role !== "user" && value.role !== "admin")) return null;
    return { id: value.id, name: typeof value.name === "string" ? value.name : null, email: typeof value.email === "string" ? value.email : null, role: value.role };
  } catch {
    return null;
  }
}

export function useAuth() {
  const utils = trpc.useUtils();
  const [loggingOut, setLoggingOut] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(pb.authStore.isValid);
  const [cachedUser, setCachedUser] = useState<CachedUser | null>(() => readCachedUser());

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: hasSession === true,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, model) => {
      const authed = Boolean(model);
      setHasSession(authed);
      if (authed) {
        void utils.auth.me.invalidate();
      } else {
        setCachedUser(null);
        try { window.localStorage.removeItem(CACHED_USER_KEY); } catch { /* Ignore storage failures during auth transitions. */ }
        utils.auth.me.setData(undefined, null);
      }
    });

    return () => unsubscribe();
  }, [utils]);

  useEffect(() => {
    if (!meQuery.data) return;
    const nextUser: CachedUser = { id: meQuery.data.id, name: meQuery.data.name, email: meQuery.data.email, role: meQuery.data.role };
    setCachedUser(nextUser);
    try { window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(nextUser)); } catch { /* Offline storage may be unavailable. */ }
  }, [meQuery.data]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      pb.authStore.clear();
      setHasSession(false);
      setCachedUser(null);
      try { window.localStorage.removeItem(CACHED_USER_KEY); } catch { /* Ignore storage failures during logout. */ }
      utils.auth.me.setData(undefined, null);
    } finally {
      setLoggingOut(false);
    }
  }, [utils]);

  const offlineFallback = typeof navigator !== "undefined" && !navigator.onLine && meQuery.isError ? cachedUser : null;
  const effectiveUser = meQuery.data ?? offlineFallback;
  const state = useMemo(
    () => ({
      user: effectiveUser,
      loading: hasSession === null || (hasSession === true && meQuery.isLoading) || loggingOut,
      error: meQuery.error ?? null,
      isAuthenticated: hasSession === true && Boolean(effectiveUser),
    }),
    [effectiveUser, hasSession, meQuery.error, meQuery.isLoading, loggingOut]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
