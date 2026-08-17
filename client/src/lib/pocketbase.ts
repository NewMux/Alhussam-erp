import PocketBase from "pocketbase";

const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL;

if (!pocketbaseUrl) {
  console.error("[PocketBase] VITE_POCKETBASE_URL is not configured.");
}

export const pb = new PocketBase(pocketbaseUrl);
