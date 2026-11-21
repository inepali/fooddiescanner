import AppShell from "@/components/AppShell";
import LargeTitle from "@/components/LargeTitle";
import ProductList from "@/components/ProductList";
import { supabase } from "@/lib/supabase";
import type { Target } from "@/lib/targets";

export const dynamic = "force-dynamic";

/** Admin: the full products-to-scan list across Costco, Sam's, Walmart, Aldi, Lidl and others. */
export default async function ProductsPage() {
  const { data, error } = await supabase()
    .from("scan_targets")
    .select("id, product, store, category, compare_group, priority, status, scan_id")
    .order("priority", { ascending: false })
    .limit(1000);
  if (error) {
    return (
      <AppShell>
        <LargeTitle title="Products to scan" />
        <p className="text-red-700">Couldn&apos;t load the list ({error.message}). Run migration 0020_scan_targets.sql in Supabase first.</p>
      </AppShell>
    );
  }
  const rows = (data ?? []) as Target[];
  const left = rows.filter((r) => r.status === "todo" || r.status === "next").length;
  return (
    <AppShell>
      <div className="space-y-5">
        <LargeTitle title="Products to scan" subtitle={`${left} to go · ${rows.filter((r) => r.status === "scanned").length} scanned`} />
        <ProductList initial={rows} />
      </div>
    </AppShell>
  );
}
