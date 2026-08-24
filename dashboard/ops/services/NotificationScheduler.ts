import { EventEmitter } from 'events';

interface Job {
  id: string;
  clientId: string;
  driverId: string;
  bookedStart: Date;
  status: string;
}

interface NotificationConfig {
  leadTimeMinutes: number;
  templateId: string;
  sendOnBehalfOfDriver: boolean;
}

export class NotificationScheduler extends EventEmitter {
  private checkIntervalMs = 60000; // Check every minute
  private timer: NodeJS.Timeout | null = null;
  private sentNotifications: Set<string> = new Set(); // Prevent duplicate sends

  constructor(private config: NotificationConfig, private getUpcomingJobs: () => Promise<Job[]>) {
    super();
  }

  public start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkAndDispatch(), this.checkIntervalMs);
    console.log(\`[NotificationScheduler] Started polling. Lead time: \${this.config.leadTimeMinutes} mins\`);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAndDispatch() {
    try {
      const upcomingJobs = await this.getUpcomingJobs();
      const now = new Date();

      for (const job of upcomingJobs) {
        if (job.status !== 'SCHEDULED') continue;

        // Calculate time until job starts
        const msUntilJob = job.bookedStart.getTime() - now.getTime();
        const minsUntilJob = Math.floor(msUntilJob / 1000 / 60);

        // If the job is within the target window (exact lead time +/- 1 minute for grace)
        if (minsUntilJob <= this.config.leadTimeMinutes && minsUntilJob >= this.config.leadTimeMinutes - 5) {
          const notifKey = \`\${job.id}-\${this.config.templateId}\`;
          
          if (!this.sentNotifications.has(notifKey)) {
            // Dispatch!
            this.emit('dispatch', {
              jobId: job.id,
              templateId: this.config.templateId,
              target: 'CLIENT',
              sender: this.config.sendOnBehalfOfDriver ? job.driverId : 'SYSTEM'
            });

            this.sentNotifications.add(notifKey);
            console.log(\`[NotificationScheduler] Dispatched \${this.config.templateId} for job \${job.id}\`);
          }
        }
      }
    } catch (err) {
      console.error('[NotificationScheduler] Error checking jobs:', err);
    }
  }
}
