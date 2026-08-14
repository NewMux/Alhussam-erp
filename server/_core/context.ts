import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const hasBearerToken =
    typeof opts.req.headers.authorization === "string" &&
    opts.req.headers.authorization.startsWith("Bearer ");

  try {
    user = await sdk.authenticateRequest(opts.req);
    console.info("[auth-context] session accepted", {
      path: opts.req.path,
      hasBearerToken,
      userId: user.id,
    });
  } catch (error) {
    // Authentication is optional for public procedures. Log only safe diagnostic
    // state; never emit the Authorization header or access token.
    console.info("[auth-context] session unavailable", {
      path: opts.req.path,
      hasBearerToken,
      reason: error instanceof Error ? error.message : "Unknown auth failure",
    });
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
