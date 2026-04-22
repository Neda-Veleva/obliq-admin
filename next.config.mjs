import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function nextConfig(phase) {
  return {
    reactStrictMode: true,
    outputFileTracingRoot: __dirname,
    // Keep dev artifacts separate from production build artifacts.
    // This prevents occasional stale chunk mismatches like missing "./611.js".
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
