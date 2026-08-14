const DEFAULT_SUPABASE_URL = "https://cevoyflcdsdkhigyunlv.supabase.co";

function validSupabaseUrl(...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const value = candidate?.trim().replace(/^['\"]|['\"]$/g, "");
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co")) {
        return parsed.toString().replace(/\/$/, "");
      }
    } catch {
      // Continue to the next candidate. A Vercel variable may contain shell quotes.
    }
  }
  return DEFAULT_SUPABASE_URL;
}

export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Prefer server-only Supabase settings for token verification. The VITE_
  // variables remain a backwards-compatible fallback for an existing deploy,
  // but should not be the server's source of truth.
  supabaseUrl: validSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL),
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  // Email address (case-insensitive) that is automatically granted the admin
  // role the first time it signs in. Set this to the shop owner's login email.
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
