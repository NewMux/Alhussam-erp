import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const [loggingOut, setLoggingOut] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Re-fetch the app-level profile whenever Supabase's session changes
  // (sign-in, sign-out, or token refresh).
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      utils.auth.me.invalidate();
    });
    return () => subscription.subscription.unsubscribe();
  }, [utils]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      utils.auth.me.setData(undefined, null);
    } finally {
      setLoggingOut(false);
    }
  }, [utils]);

  const state = useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || loggingOut,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    }),
    [meQuery.data, meQuery.error, meQuery.isLoading, loggingOut]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
