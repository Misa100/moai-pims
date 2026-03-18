import { createClient } from "@refinedev/supabase";

const SUPABASE_URL = "https://vajfrtovfusygoljujoe.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhamZydG92ZnVzeWdvbGp1am9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1ODYwNzAsImV4cCI6MjA3MjE2MjA3MH0.uNco8lSNFO287RzoS5CRyk8yvvg5VEbXqFFSf-TWrLg";


export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    schema: "public",
  },
  auth: {
    persistSession: true,
  },
});
