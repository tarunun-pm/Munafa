/**
 * Verifies Supabase connection and that Layer 1 schema + seed data exist.
 * Run: npx tsx scripts/verify-db.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main(): Promise<void> {
  if (!url || !anonKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const key = serviceKey || anonKey;
  const client = createClient(url, key);

  const tables = [
    "vendors",
    "items",
    "suppliers",
    "transactions",
    "daily_summaries",
    "price_history",
  ] as const;

  for (const table of tables) {
    const { error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`❌ Table "${table}": ${error.message}`);
      process.exit(1);
    }
    console.log(`✅ Table "${table}" exists`);
  }

  const { count, error: itemsError } = await client
    .from("items")
    .select("*", { count: "exact", head: true })
    .is("vendor_id", null);

  if (itemsError) {
    console.error(`❌ Items seed check failed: ${itemsError.message}`);
    process.exit(1);
  }

  console.log(`✅ Global items seeded: ${count ?? 0} rows (expected 30)`);

  if ((count ?? 0) < 30) {
    console.warn("⚠️  Seed may be incomplete — re-run migration or check SQL Editor");
    process.exit(1);
  }

  console.log("\nLayer 1 database verification passed.");
}

main();
