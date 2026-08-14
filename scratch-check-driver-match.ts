import { getNextJobForDriver } from "./src/jobs/jobs.service";
import { getDriver } from "./src/google/sheets";

async function main() {
  const identifier = process.argv[2] || "roman@elevariq.online";
  const driver = await getDriver(identifier);
  console.log("driver profile:", JSON.stringify(driver, null, 2));

  const result = await getNextJobForDriver(identifier, { sync: true });
  console.log("next job:", result.job ? result.job.jobId : null, result.job?.status, result.job?.bookedStart, result.job?.driverInitials);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
