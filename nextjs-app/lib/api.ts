export function publicApiUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://127.0.0.1:4000";
  return u.replace(/\/$/, "");
}
