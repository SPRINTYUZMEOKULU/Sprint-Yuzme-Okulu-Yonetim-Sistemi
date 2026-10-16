import "server-only";
import { createClient } from "@supabase/supabase-js";

// Callers must authenticate and authorize first, and scope every query to organization_id.
export function documentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Ödeme bağlantısı yapılandırılmamış.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
