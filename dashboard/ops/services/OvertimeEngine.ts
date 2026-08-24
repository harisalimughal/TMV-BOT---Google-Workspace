export interface OvertimeConfig {
  packingRatePerHour: number;
  crewRates: Record<string, number>;
  billingUnit: 'PER_30_MIN' | 'PER_HOUR';
  gracePeriodMinutes: number;
}

export interface JobTimestamps {
  bookedDurationMinutes: number;
  actualStart: Date;
  actualFinish: Date;
  driverEnteredOvertimeMinutes: number;
  serviceType: string;
}

export class OvertimeEngine {
  private config: OvertimeConfig;

  constructor(config: OvertimeConfig) {
    this.config = config;
  }

  /**
   * Reconciles the driver's manually entered overtime against the server's time engine timestamps.
   * Returns the final overtime charge and whether it was flagged for admin review.
   */
  public reconcileOvertime(job: JobTimestamps): { 
    chargeableMinutes: number; 
    chargeAmount: number; 
    isFlagged: boolean; 
    reason?: string 
  } {
    const elapsedMs = job.actualFinish.getTime() - job.actualStart.getTime();
    const actualElapsedMinutes = Math.round(elapsedMs / 1000 / 60);
    
    const driverTotalClaimedMinutes = job.bookedDurationMinutes + job.driverEnteredOvertimeMinutes;
    
    // Check if the driver is claiming significantly more time than the time engine recorded
    const discrepancy = driverTotalClaimedMinutes - actualElapsedMinutes;
    
    let isFlagged = false;
    let reason = undefined;

    if (discrepancy > this.config.gracePeriodMinutes) {
      isFlagged = true;
      reason = \`Driver claimed \${job.driverEnteredOvertimeMinutes}m overtime, but server timestamps show only \${actualElapsedMinutes}m total elapsed (\${job.bookedDurationMinutes}m booked). Discrepancy: \${discrepancy}m.\`;
    }

    // Determine base rate for the service type
    let ratePerUnit = 0;
    let unitMinutes = this.config.billingUnit === 'PER_30_MIN' ? 30 : 60;

    if (job.serviceType === 'PACKING') {
      ratePerUnit = this.config.packingRatePerHour;
      unitMinutes = 60; // Packing is strictly per hour
    } else {
      ratePerUnit = this.config.crewRates[job.serviceType] || this.config.crewRates['man_van'];
    }

    // Calculate billing periods based on the driver's claimed overtime (unless heavily flagged, then we might cap it, but per spec driver entered is used to determine charge unless admin intervenes)
    // For simplicity, we calculate the charge based on the driver's entry. Admin can review flagged entries.
    const billingPeriods = Math.ceil(job.driverEnteredOvertimeMinutes / unitMinutes);
    const chargeAmount = billingPeriods * ratePerUnit;

    return {
      chargeableMinutes: job.driverEnteredOvertimeMinutes,
      chargeAmount,
      isFlagged,
      reason
    };
  }
}
