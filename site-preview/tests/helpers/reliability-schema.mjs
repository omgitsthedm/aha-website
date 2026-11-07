import { readFile } from 'node:fs/promises';
// Older focused fixtures predate the additive production migration. Apply its
// prerequisites only when absent, keeping each fixture's historical data intact.
export async function reliabilitySchema(pg) {
 const prerequisites=[['aha_fulfillment_orders','20261015045000_yikes_fulfillment'],['aha_checkout_sessions','20261015160000_custom_checkout'],['aha_order_notifications','20261015170000_order_notifications'],['aha_owner_reports','20261016130000_owner_reports'],['aha_commerce_workers','20261107020000_commerce_safeguards'],['aha_order_financials','20261107090000_commerce_reliability']];
 for(const [table,name] of prerequisites) {
  const {rows:[row]}=await pg.query('SELECT to_regclass($1) AS name',[table]);
  if(!row.name) await pg.exec(await readFile(new URL(`../../netlify/database/migrations/${name}/migration.sql`,import.meta.url),'utf8'));
 }
}
