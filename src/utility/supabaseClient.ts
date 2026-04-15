import { createClient } from "@refinedev/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    schema: "public",
  },
  auth: {
    persistSession: true,
  },
});