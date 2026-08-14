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

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Temporary token-safe diagnostic for the production session verification path.
    console.info("[auth-context] session unavailable", {
      path: opts.req.path,
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
