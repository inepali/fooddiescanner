import { supabase } from "./supabase.ts";
import { WANTED_SHOWN } from "./targets.ts";

/** The "Wanted next" products members see (server only). Empty if the list isn't set up yet. */
export async function wantedProducts(): Promise<{ id: string; product: string; store: string }[]> {
  const { data, error } = await supabase()
    .from("scan_targets")
    .select("id, product, store")
    .eq("status", "next")
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(WANTED_SHOWN);
  if (error) return [];
  return (data ?? []) as { id: string; product: string; store: string }[];
}
