import { getJob } from "./src/google/sheets";

async function main() {
  const job = await getJob("TMV-0542E9A913", 0);
  console.log(JSON.stringify(job, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
