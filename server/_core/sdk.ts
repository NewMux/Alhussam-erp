import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const SUPABASE_AUTH_USER_URL = "https://cevoyflcdsdkhigyunlv.supabase.co/auth/v1/user";

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    name?: unknown;
    full_name?: unknown;
  } | null;
};

async function getSupabaseUser(accessToken: string): Promise<SupabaseAuthUser> {
  if (!ENV.supabaseAnonKey) {
    throw ForbiddenError("Server authentication is not configured");
  }

  let response: Response;
  try {
    response = await fetch(SUPABASE_AUTH_USER_URL, {
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw ForbiddenError("Session verification unavailable");
  }

  if (!response.ok) {
    throw ForbiddenError("Invalid session");
  }

  const data = (await response.json()) as SupabaseAuthUser;
  if (!data?.id) {
    throw ForbiddenError("Invalid session");
  }
  return data;
}

class SDKServer {
  /**
   * Verifies the Supabase access token sent as `Authorization: Bearer <token>`
   * against the Supabase Auth user endpoint, then syncs it to the app-level
   * `users` row (role/pending-approval gating lives there, not in Supabase).
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

    const authUser = await getSupabaseUser(token);
    const metadata = authUser.user_metadata;
    const name =
      (typeof metadata?.name === "string" && metadata.name) ||
      (typeof metadata?.full_name === "string" && metadata.full_name) ||
      authUser.email ||
      "";

    await db.upsertUser({
      openId: authUser.id,
      name,
      email: authUser.email ?? null,
      loginMethod: "supabase",
      lastSignedIn: new Date(),
    });

    const user = await db.getUserByOpenId(authUser.id);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new SDKServer();
