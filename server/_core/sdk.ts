import { ForbiddenError } from "@shared/_core/errors";
import type { User } from "@shared/pb-types";
import type { Request } from "express";
import { getPb, syncAppUser } from "../pb";
import { ENV } from "./env";

class SDKServer {
  /**
   * Verifies the PocketBase auth token sent as `Authorization: <token>`
   * against PocketBase's own auth-refresh endpoint, then syncs the
   * OWNER_EMAIL/pending-approval gate onto the record (see syncAppUser).
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
    if (!ENV.pocketbaseUrl) {
      throw ForbiddenError("Server authentication is not configured");
    }

    let response: Response;
    try {
      response = await fetch(`${ENV.pocketbaseUrl}/api/collections/users/auth-refresh`, {
        method: "POST",
        headers: { Authorization: token },
      });
    } catch {
      throw ForbiddenError("Session verification unavailable");
    }
    if (!response.ok) {
      throw ForbiddenError("Invalid session");
    }

    const data = (await response.json()) as { record?: User };
    if (!data?.record?.id) {
      throw ForbiddenError("Invalid session");
    }

    await getPb();
    return syncAppUser(data.record);
  }
}

export const sdk = new SDKServer();
