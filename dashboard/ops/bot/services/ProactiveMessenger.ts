/**
 * ProactiveMessenger.ts
 * Interfaces with Google Chat API to push messages directly to drivers
 * bypassing the need for them to send a slash command first.
 */

export class ProactiveMessenger {
  private driverSpaceMapping: Map<string, string>;

  constructor() {
    // In production, this would be fetched from the database
    this.driverSpaceMapping = new Map([
      ['WD', 'spaces/AAAA1234567'],
      ['RC', 'spaces/AAAA7654321']
    ]);
  }

  /**
   * Pushes a job assignment notification immediately when an admin assigns it.
   */
  public async pushAssignmentNotification(driverCode: string, jobId: string, details: any): Promise<boolean> {
    const spaceId = this.driverSpaceMapping.get(driverCode);
    
    if (!spaceId) {
      console.warn(\`[ProactiveMessenger] No Google Chat space mapped for driver \${driverCode}\`);
      return false;
    }

    const messageContent = \`*NEW JOB ASSIGNED: \${jobId}*\nClient: \${details.clientName}\nPickup: \${details.pickup}\nTime: \${details.time}\n\nPlease reply to confirm receipt.\`;

    try {
      // In a real implementation:
      // await googleChatClient.spaces.messages.create({
      //   parent: spaceId,
      //   requestBody: { text: messageContent }
      // });
      console.log(\`[ProactiveMessenger] -> PUSHED TO \${spaceId}:\n\${messageContent}\`);
      return true;
    } catch (err) {
      console.error(\`[ProactiveMessenger] Failed to push to \${driverCode}:\`, err);
      return false;
    }
  }

  /**
   * Pushes an unassignment notification when an admin removes a driver from a job.
   */
  public async pushUnassignmentNotification(driverCode: string, jobId: string): Promise<boolean> {
    const spaceId = this.driverSpaceMapping.get(driverCode);
    if (!spaceId) return false;

    const messageContent = \`*JOB UPDATE*\nYou have been unassigned from job \${jobId}. You no longer need to attend this move.\`;
    
    console.log(\`[ProactiveMessenger] -> PUSHED TO \${spaceId}:\n\${messageContent}\`);
    return true;
  }
}
