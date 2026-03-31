export function publicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
}

export function serverApiUrl(): string {
  return process.env.INTERNAL_API_URL ?? publicApiUrl();
}
