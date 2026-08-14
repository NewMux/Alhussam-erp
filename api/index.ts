import { createApp } from "../server/_core/app";

// Vercel's Node runtime invokes an Express app instance directly as its
// request handler. vercel.json rewrites /api/* and /manus-storage/* here,
// preserving the original path so Express's own routing still applies.
export default createApp();
