import { describe, expect, it } from "vitest";
import { readSupabaseConfiguration } from "@/lib/supabase-config";

describe("Supabase configuration", () => {
  it("reports missing deployment variables", () => {
    expect(readSupabaseConfiguration(undefined, undefined)).toEqual({
      ok: false,
      message:
        "Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY.",
    });
  });

  it("requires HTTPS for non-local Supabase URLs", () => {
    expect(readSupabaseConfiguration("http://project.supabase.co", "public-key")).toEqual({
      ok: false,
      message: "VITE_SUPABASE_URL must use HTTPS, except for local development.",
    });
  });

  it("accepts a valid hosted Supabase configuration", () => {
    expect(
      readSupabaseConfiguration(" https://project.supabase.co ", " public-key "),
    ).toEqual({
      ok: true,
      url: "https://project.supabase.co",
      publishableKey: "public-key",
    });
  });

  it("allows HTTP for local development", () => {
    expect(readSupabaseConfiguration("http://localhost:54321", "public-key")).toEqual({
      ok: true,
      url: "http://localhost:54321",
      publishableKey: "public-key",
    });
  });
});
