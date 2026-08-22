import React from "react";
import { Check, Loader2, AlertCircle, Circle } from "lucide-react";
import { EvidenceState } from "../types";

interface Props {
  completeness: {
    arrival: EvidenceState;
    vanLoaded: EvidenceState;
    emptyVan: EvidenceState;
    organized: EvidenceState;
    signature: EvidenceState;
  };
}

const ITEMS: Array<{ key: keyof Props["completeness"]; label: string; short: string }> = [
  { key: "arrival", label: "Arrival Photo", short: "ARR" },
  { key: "vanLoaded", label: "Van Loaded Photo", short: "LOAD" },
  { key: "emptyVan", label: "Empty Van Photo", short: "EMPTY" },
  { key: "organized", label: "Organized Photo", short: "ORG" },
  { key: "signature", label: "Customer Signature", short: "SIG" }
];

export function EvidenceCompletenessPill({ completeness }: Props) {
  return (
    <div className="inline-flex items-center gap-1.5 p-1 bg-surface-2 rounded-lg border border-line">
      {ITEMS.map(({ key, label, short }) => {
        const state = completeness[key];

        let stateStyles = "bg-gray-100 text-gray-400 border-gray-200";
        let icon = <Circle className="w-2.5 h-2.5 fill-current" />;

        if (state === "COMPLETED") {
          stateStyles = "bg-emerald-50 text-status-green border-emerald-300 font-medium";
          icon = <Check className="w-3 h-3 stroke-[3]" />;
        } else if (state === "PROCESSING") {
          stateStyles = "bg-amber-50 text-status-orange border-amber-300 font-medium";
          icon = <Loader2 className="w-3 h-3 animate-spin" />;
        } else if (state === "FAILED") {
          stateStyles = "bg-rose-50 text-status-red border-rose-300 font-medium";
          icon = <AlertCircle className="w-3 h-3" />;
        } else if (state === "MISSING") {
          stateStyles = "bg-pink-50 text-status-pink border-pink-200";
          icon = <Circle className="w-2.5 h-2.5" />;
        }

        return (
          <div
            key={key}
            title={`${label}: ${state}`}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${stateStyles}`}
          >
            {icon}
            <span>{short}</span>
          </div>
        );
      })}
    </div>
  );
}
