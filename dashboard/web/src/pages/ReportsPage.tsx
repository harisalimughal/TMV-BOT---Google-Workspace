import React from "react";
import { FileSpreadsheet, Download, CheckCircle2 } from "lucide-react";
import { sounds } from "../utils/audio";

export function ReportsPage() {
  const downloadAllJobsCsv = () => {
    sounds.playSuccess();
    window.location.href = "/ops/api/jobs/export.csv";
  };

  const downloadCompletedJobsCsv = () => {
    sounds.playSuccess();
    window.location.href = "/ops/api/jobs/export.csv?status=COMPLETED";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-paper p-5 rounded-lg border border-line">
        <h2 className="text-xl font-bold text-ink tracking-tight">Reports</h2>
        <p className="text-xs text-muted mt-0.5">Downloadable operational datasets and certified export files</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Jobs CSV */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-2xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-navy-900 text-tmv-cyan flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-ink mb-1">Complete Jobs Workbook (CSV)</h3>
            <p className="text-xs text-muted mb-4">
              Full dataset including scheduled start, actual timing variance, financials, driver mapping and evidence status.
            </p>
          </div>
          <button
            onClick={downloadAllJobsCsv}
            className="w-full py-2.5 px-4 rounded-lg bg-navy-900 text-white text-btn hover:bg-navy-800 transition flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-tmv-cyan" />
            Download Complete CSV
          </button>
        </div>

        {/* Finished Jobs CSV */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-2xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-900 text-status-green flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5 text-status-green" />
            </div>
            <h3 className="text-sm font-bold text-ink mb-1">Completed Jobs Audit (CSV)</h3>
            <p className="text-xs text-muted mb-4">
              Filtered to completed jobs with financial totals, customer sign-off names and Drive folder URLs.
            </p>
          </div>
          <button
            onClick={downloadCompletedJobsCsv}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-btn hover:bg-emerald-700 transition flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Completed Jobs CSV
          </button>
        </div>
      </div>
    </div>
  );
}
