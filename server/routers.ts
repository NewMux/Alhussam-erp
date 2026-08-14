import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { erpRouter } from "./erp";
import { posRouter } from "./pos";

// Registration, login, and logout are handled entirely client-side by the
// Supabase client SDK (supabase.auth.signUp/signInWithPassword/signOut).
// The server only ever verifies the resulting access token (see
// server/_core/sdk.ts) and reports the synced app-level user profile here.
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
});

export const appRouter = router({ system: systemRouter, auth: authRouter, erp: erpRouter, pos: posRouter });
export type AppRouter = typeof appRouter;
