import React from "react";
import { CheckCircle2, Clock, Calendar, XCircle, AlertTriangle } from "lucide-react";
import { DelayBand, JobStatus } from "../types";

export function JobStatusBadge({ status }: { status: JobStatus | string }) {
  switch (status) {
    case "READY":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-tmv-blue border border-blue-200">
          <Calendar className="w-3.5 h-3.5" />
          Scheduled
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-status-orange border border-amber-200">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          In Progress
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-status-green border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-status-red border border-rose-200">
          <XCircle className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-status-grey border border-gray-200">
          {status}
        </span>
      );
  }
}

export function DelayBandBadge({ band, minutes }: { band: DelayBand; minutes: number }) {
  if (minutes === 0 || band === "ON_TIME") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-green">
        <CheckCircle2 className="w-3.5 h-3.5" /> On Time
      </span>
    );
  }
  if (minutes < 0 || band === "EARLY") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-tmv-blue">
        <Clock className="w-3.5 h-3.5" /> {Math.abs(minutes)}m early
      </span>
    );
  }
  if (band === "LATE_5_15") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-orange">
        <AlertTriangle className="w-3.5 h-3.5" /> +{minutes}m late
      </span>
    );
  }
  if (band === "LATE_15_30") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-red">
        <AlertTriangle className="w-3.5 h-3.5" /> +{minutes}m late
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-status-red-bg text-status-red border border-red-200">
      <AlertTriangle className="w-3.5 h-3.5" /> +{minutes}m late
    </span>
  );
}
