import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { getPb } from "./pb";

export async function pbOrThrow() {
  if (!ENV.pocketbaseUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  return getPb();
}

/** First record matching `filter` (optionally sorted), or null (PocketBase throws 404 otherwise). */
export async function findOne<T>(collection: string, filter: string, sort?: string): Promise<T | null> {
  const pb = await getPb();
  try {
    return await pb.collection(collection).getFirstListItem<T>(filter, sort ? { sort } : undefined);
  } catch {
    return null;
  }
}

export async function findById<T>(collection: string, id: string | null | undefined): Promise<T | null> {
  if (!id) return null;
  const pb = await getPb();
  try {
    return await pb.collection(collection).getOne<T>(id);
  } catch {
    return null;
  }
}

/** Update the record matching `filter` if one exists, otherwise create it. */
export async function upsert<T extends { id: string }>(collection: string, filter: string, values: Record<string, unknown>): Promise<T> {
  const pb = await getPb();
  const existing = await findOne<T>(collection, filter);
  if (existing) return pb.collection(collection).update<T>(existing.id, values);
  return pb.collection(collection).create<T>(values);
}

/** Builds a PocketBase filter expression with safely-escaped parameters. */
export async function pbFilter(expr: string, params: Record<string, unknown>): Promise<string> {
  const pb = await getPb();
  return pb.filter(expr, params);
}
