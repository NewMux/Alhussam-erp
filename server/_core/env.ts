export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Same project the client uses (VITE_-prefixed so Vite also inlines them
  // into the browser bundle). Used server-side to verify access tokens via
  // Supabase's own /auth/v1/user endpoint — no separate JWT secret needed.
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  // Email address (case-insensitive) that is automatically granted the admin
  // role the first time it signs in. Set this to the shop owner's login email.
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
