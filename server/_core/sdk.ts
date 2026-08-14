import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import { jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

type SupabaseClaims = {
  sub: string;
  email?: string;
  name?: string;
};

class SDKServer {
  private getJwtSecret() {
    return new TextEncoder().encode(ENV.supabaseJwtSecret);
  }

  private async verifySupabaseToken(token: string): Promise<SupabaseClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.getJwtSecret(), {
        algorithms: ["HS256"],
      });

      const sub = payload.sub;
      if (typeof sub !== "string" || !sub) return null;

      const metadata = payload.user_metadata as
        | { name?: unknown; full_name?: unknown }
        | undefined;
      const name =
        (typeof metadata?.name === "string" && metadata.name) ||
        (typeof metadata?.full_name === "string" && metadata.full_name) ||
        undefined;

      return {
        sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Supabase token verification failed", String(error));
      return null;
    }
  }

  /**
   * Verifies the Supabase access token sent as `Authorization: Bearer <token>`
   * and syncs it to our app-level `users` row (role/pending-approval gating
   * lives there, not in Supabase).
   */
  async authenticateRequest(req: Request): Promise<User> {
    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;
    if (!token) {
      throw ForbiddenError("Missing session");
    }

    const claims = await this.verifySupabaseToken(token);
    if (!claims) {
      throw ForbiddenError("Invalid session");
    }

    await db.upsertUser({
      openId: claims.sub,
      name: claims.name || claims.email || "",
      email: claims.email ?? null,
      loginMethod: "supabase",
      lastSignedIn: new Date(),
    });

    const user = await db.getUserByOpenId(claims.sub);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new SDKServer();
