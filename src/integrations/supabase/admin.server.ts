// Server-only Supabase client com service role.
// NUNCA importar este arquivo em código client-side.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/integrations/supabase/client";

export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
