import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://kybkhnshgrlhrjqbulyq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_ZxK_Bt25FywCXJBe_vYX5Q_VjP9IkG4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
