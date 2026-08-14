import { createApp } from "./_core/app";

// This module is bundled by the `build:vercel` script into `api/index.js`.
// Keeping the whole local server graph in one file avoids Node ESM resolving
// raw TypeScript extensionless imports at Vercel runtime.
export default createApp();
