/**
 * schedule.ts
 * Google Chat bot handler for driver schedule requests.
 */

export async function handleScheduleRequest(driverCode: string, isTomorrow: boolean = false): Promise<string> {
  // In production: fetch from database where assignedDriver === driverCode
  // Mocking database fetch:
  const mockDbJobs = [
    { id: 'TMV-101', date: 'TODAY', driver: 'WD', time: '10:00' },
    { id: 'TMV-102', date: 'TOMORROW', driver: 'WD', time: '09:00' },
    { id: 'TMV-103', date: 'TOMORROW', driver: 'UN', time: '14:00' }, // Unassigned job
  ];

  const targetDate = isTomorrow ? 'TOMORROW' : 'TODAY';
  
  // 1. Get jobs assigned to this driver
  const assignedJobs = mockDbJobs.filter(j => j.date === targetDate && j.driver === driverCode);
  
  // 2. Check if there are unassigned jobs on the schedule
  const unassignedJobs = mockDbJobs.filter(j => j.date === targetDate && j.driver === 'UN');

  if (assignedJobs.length > 0) {
    let msg = \`*Your Schedule for \${targetDate.toLowerCase()}*\n\n\`;
    assignedJobs.forEach(j => {
      msg += \`\u2022 \${j.time} - Job \${j.id}\n\`;
    });
    return msg;
  } else {
    // Requirements #2: Handling Unassigned Jobs
    if (unassignedJobs.length > 0) {
      return \`You don't currently have a job assigned for \${targetDate.toLowerCase()}. Your schedule may be updated by the admin.\`;
    } else {
      return \`You have no jobs and there are no unassigned jobs for \${targetDate.toLowerCase()}.\`;
    }
  }
}
