import { ForbiddenError } from "@shared/_core/errors";
import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);

class SDKServer {
  /**
   * Verifies the Supabase access token sent as `Authorization: Bearer <token>`
   * against Supabase's own auth server, then syncs it to our app-level
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

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw ForbiddenError("Invalid session");
    }

    const metadata = data.user.user_metadata as
      | { name?: unknown; full_name?: unknown }
      | undefined;
    const name =
      (typeof metadata?.name === "string" && metadata.name) ||
      (typeof metadata?.full_name === "string" && metadata.full_name) ||
      data.user.email ||
      "";

    await db.upsertUser({
      openId: data.user.id,
      name,
      email: data.user.email ?? null,
      loginMethod: "supabase",
      lastSignedIn: new Date(),
    });

    const user = await db.getUserByOpenId(data.user.id);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new SDKServer();
