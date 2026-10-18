export type SupabaseConfiguration =
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; message: string };

export function readSupabaseConfiguration(
  urlValue: string | undefined,
  keyValue: string | undefined,
): SupabaseConfiguration {
  const url = urlValue?.trim();
  const publishableKey = keyValue?.trim();

  if (!url || !publishableKey) {
    const missing = [
      !url && "VITE_SUPABASE_URL",
      !publishableKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
    ].filter(Boolean);
    return {
      ok: false,
      message: `Missing required environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, message: "VITE_SUPABASE_URL must be a valid URL." };
  }

  const isLocalUrl = ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== "https:" && !(isLocalUrl && parsedUrl.protocol === "http:")) {
    return {
      ok: false,
      message: "VITE_SUPABASE_URL must use HTTPS, except for local development.",
    };
  }

  return { ok: true, url, publishableKey };
}
