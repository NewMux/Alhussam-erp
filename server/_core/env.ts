function cleanEnvironmentValue(value: string | undefined): string {
  return value?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}

// Read lazily (getters, not values captured at import time) so tests can set
// process.env.POCKETBASE_URL etc. after this module has already been
// imported by the router graph and still have it take effect.
export const ENV = {
  // Base URL of the PocketBase instance backing this shop (e.g. the shop's
  // subdomain on the shared VPS: https://tailor.example.com).
  get pocketbaseUrl() {
    return cleanEnvironmentValue(process.env.POCKETBASE_URL).replace(/\/$/, "");
  },
  // Superuser credentials the Node server authenticates as to read/write
  // every collection on the shop owner's behalf. Never exposed to the browser.
  get pocketbaseSuperuserEmail() {
    return cleanEnvironmentValue(process.env.POCKETBASE_SUPERUSER_EMAIL);
  },
  get pocketbaseSuperuserPassword() {
    return cleanEnvironmentValue(process.env.POCKETBASE_SUPERUSER_PASSWORD);
  },
  // Email address (case-insensitive) that is automatically granted the admin
  // role the first time it signs in. Set this to the shop owner's login email.
  get ownerEmail() {
    return (process.env.OWNER_EMAIL ?? "").toLowerCase();
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.BUILT_IN_FORGE_API_URL ?? "";
  },
  get forgeApiKey() {
    return process.env.BUILT_IN_FORGE_API_KEY ?? "";
  },
};
