/**
 * Collapsed from a 14-state linear sequence to 3. The old WAITING_* sub-states drove
 * one fixed step-by-step flow; the driver now picks freely from a menu of independent
 * scenarios instead, so there is no "next" state to track — just whether the job has
 * been started and finished. Old rows with a granular value in "Current State" (e.g.
 * "WAITING_TOTAL_CHARGES") still read back fine — it's a plain string column, kept
 * only as audit history, never compared against.
 */
export enum WorkflowState {
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED"
}
