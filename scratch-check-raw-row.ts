import { listObjects, SHEETS } from "./src/google/sheets";

async function main() {
  const rows = await listObjects(SHEETS.BOOKINGS, 0);
  const row = rows.find(r => r["Job ID"] === "TMV-0542E9A913");
  console.log(JSON.stringify(row, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
