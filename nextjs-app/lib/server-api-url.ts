/**
 * Base URL para Server Components chamarem a Nest **via proxy do Next**.
 * Evita fetch direto a nestjs-api/127.0.0.1:4000 dentro do contentor (onde falha).
 * Ver rewrites em next.config.ts → /api/backend/:path*
 */
export function serverApiUrl(): string {
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}/api/backend`;
}
