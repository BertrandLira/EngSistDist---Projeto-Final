import fs from "node:fs";
import type { NextConfig } from "next";

/**
 * Destino das rewrites (Nest). No contentor Next, 127.0.0.1:4000 não é a API.
 */
function nestBackendBase(): string {
  const fromEnv = process.env.INTERNAL_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    if (fs.existsSync("/.dockerenv")) {
      return "http://nestjs-api:4000";
    }
  } catch {
    /* ignore */
  }
  return "http://127.0.0.1:4000";
}

const nextConfig: NextConfig = {
  async rewrites() {
    const base = nestBackendBase();
    return [
      {
        source: "/api/backend/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;
