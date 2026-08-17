import PocketBase from "pocketbase";
import type { PendingAccessRequest, User } from "@shared/pb-types";
import { ENV } from "./_core/env";

let client: PocketBase | null = null;
let authing: Promise<void> | null = null;

/**
 * A single superuser-authenticated PocketBase client shared by every
 * request. All RBAC/validation happens in the tRPC layer (server/erp.ts,
 * server/pos.ts) — this client always has full collection access, the same
 * way the old Drizzle client always had a raw Postgres connection.
 */
export async function getPb(): Promise<PocketBase> {
  if (!ENV.pocketbaseUrl) return null as unknown as PocketBase;
  if (!client) {
    client = new PocketBase(ENV.pocketbaseUrl);
    // The SDK's auto-cancellation assumes one browser tab firing one request
    // at a time; this client is a long-lived singleton serving many
    // concurrent Node requests, where two callers hitting the same
    // collection+method at once must both complete, not cancel each other.
    client.autoCancellation(false);
  }
  if (!client.authStore.isValid) {
    if (!authing) {
      authing = client
        .collection("_superusers")
        .authWithPassword(ENV.pocketbaseSuperuserEmail, ENV.pocketbaseSuperuserPassword)
        .then(() => undefined)
        .finally(() => { authing = null; });
    }
    await authing;
  }
  return client;
}

/**
 * Promotes OWNER_EMAIL to admin on sign-in, and opens (or re-opens, if a
 * prior request was rejected) a pending ERP access request for everyone
 * else's first sign-in. Mirrors the old upsertUser() gate, but PocketBase's
 * `users` record is already both the auth identity and the app-level user
 * row, so there's no separate sync step needed beyond this.
 */
export async function syncAppUser(user: User): Promise<User> {
  const pb = await getPb();
  const isOwner = ENV.ownerEmail.length > 0 && user.email.toLowerCase() === ENV.ownerEmail;
  const updates: Partial<User> = { lastSignedIn: new Date().toISOString() };
  if (isOwner && user.role !== "admin") updates.role = "admin";
  const updated = await pb.collection("users").update<User>(user.id, updates);

  if (isOwner) return updated;

  const existingRequest = await pb
    .collection("pendingAccessRequests")
    .getFullList<PendingAccessRequest>({ filter: `userId = "${user.id}"` });
  if (existingRequest.length === 0) {
    await pb.collection("pendingAccessRequests").create({ userId: user.id, status: "pending", requestedAt: new Date().toISOString() });
  } else if (existingRequest[0].status === "rejected") {
    await pb.collection("pendingAccessRequests").update(existingRequest[0].id, { status: "pending", requestedAt: new Date().toISOString(), reviewedAt: null, reviewedBy: null, note: null });
  }
  return updated;
}
