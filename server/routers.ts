import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { erpRouter } from "./erp";
import { posRouter } from "./pos";

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

async function issueSession(ctx: Pick<TrpcContext, "req" | "res">, user: { openId: string; name: string | null }) {
  const token = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
  ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
}

const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),

  register: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(2, "Name must be at least 2 characters").max(160),
        email: emailSchema,
        password: passwordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const passwordHash = hashPassword(input.password);
      const user = await db.createLocalUser({ email: input.email, name: input.name, passwordHash });
      if (!user) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Please sign in instead." });
      }
      await issueSession(ctx, user);
      return user;
    }),

  login: publicProcedure
    .input(z.object({ email: emailSchema, password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByOpenId(input.email);
      if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }
      await db.upsertUser({ openId: user.openId, name: user.name, email: user.email, loginMethod: "password", role: user.role, lastSignedIn: new Date() });
      await issueSession(ctx, user);
      return user;
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});

export const appRouter = router({ system: systemRouter, auth: authRouter, erp: erpRouter, pos: posRouter });
export type AppRouter = typeof appRouter;
