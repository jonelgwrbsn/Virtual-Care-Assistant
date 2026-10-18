import { createClient } from "@supabase/supabase-js";
import { readSupabaseConfiguration } from "./supabase-config";

const configuration = readSupabaseConfiguration(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

if (configuration.ok === false) {
  throw new Error(configuration.message);
}

export const supabase = createClient(configuration.url, configuration.publishableKey);

export type Role = "patient" | "doctor" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
