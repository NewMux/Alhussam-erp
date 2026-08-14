export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Shared secret used to verify Supabase-issued JWTs (Supabase dashboard →
  // Project Settings → API → JWT Settings → JWT Secret).
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
  // Email address (case-insensitive) that is automatically granted the admin
  // role the first time it signs in. Set this to the shop owner's login email.
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
