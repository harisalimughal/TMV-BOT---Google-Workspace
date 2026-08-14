import { listJobs } from "./src/google/sheets";

async function main() {
  const jobs = await listJobs();
  const barry = jobs.filter(j => j.customerName === "Barry" || j.driverInitials === "WD");
  console.log(JSON.stringify(barry, null, 2));
  console.log("total jobs:", jobs.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
