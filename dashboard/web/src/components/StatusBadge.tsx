import React from "react";
import { CheckCircle2, Clock, Calendar, XCircle, AlertTriangle } from "lucide-react";
import { DelayBand, JobStatus } from "../types";

export function JobStatusBadge({ status }: { status: JobStatus | string }) {
  switch (status) {
    case "READY":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium bg-surface text-ink-2 border border-line">
          <Calendar className="w-3 h-3 text-muted" />
          Scheduled
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium bg-brand-soft text-brand border border-brand/20">
          <Clock className="w-3 h-3 animate-pulse" />
          In Progress
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium bg-status-green-bg text-status-green border border-status-green/20">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium bg-status-red-bg text-status-red border border-status-red/20">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium bg-surface text-ink-2 border border-line">
          {status}
        </span>
      );
  }
}

export function DelayBandBadge({ band, minutes }: { band: DelayBand; minutes: number }) {
  if (minutes === 0 || band === "ON_TIME") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium bg-status-green-bg text-status-green border border-status-green/20">
        <CheckCircle2 className="w-3 h-3" /> On time
      </span>
    );
  }
  if (minutes < 0 || band === "EARLY") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium bg-brand-soft text-brand border border-brand/20">
        <Clock className="w-3 h-3" /> {Math.abs(minutes)}m early
      </span>
    );
  }
  if (band === "LATE_5_15") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium bg-status-amber-bg text-status-amber border border-status-amber/20">
        <AlertTriangle className="w-3 h-3" /> +{minutes}m delay
      </span>
    );
  }
  if (band === "LATE_15_30") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium bg-status-red-bg text-status-red border border-status-red/20">
        <AlertTriangle className="w-3 h-3" /> +{minutes}m delay
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium bg-status-red-bg text-status-red border border-status-red/30">
      <AlertTriangle className="w-3 h-3" /> +{minutes}m severe delay
    </span>
  );
}
