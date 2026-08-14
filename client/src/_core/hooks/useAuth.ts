import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const [loggingOut, setLoggingOut] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Do not request the ERP profile until Supabase has restored local session
  // storage. Otherwise the initial auth.me request can be cached as anonymous.
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: hasSession === true,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      if (session) {
        void utils.auth.me.invalidate();
      } else {
        utils.auth.me.setData(undefined, null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [utils]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      setHasSession(false);
      utils.auth.me.setData(undefined, null);
    } finally {
      setLoggingOut(false);
    }
  }, [utils]);

  const state = useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: hasSession === null || (hasSession === true && meQuery.isLoading) || loggingOut,
      error: meQuery.error ?? null,
      isAuthenticated: hasSession === true && Boolean(meQuery.data),
    }),
    [hasSession, meQuery.data, meQuery.error, meQuery.isLoading, loggingOut]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
