// Server-only Supabase client com service role.
// NUNCA importar este arquivo em código client-side.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/integrations/supabase/client";

export function getSupabaseAdmin() {
  // Aceita SB_SERVICE_ROLE_KEY (preferido) ou SUPABASE_SERVICE_ROLE_KEY
  // (caso a integração Supabase nativa exponha automaticamente).
  const serviceKey =
    process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SB_SERVICE_ROLE_KEY não configurada (ou SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
