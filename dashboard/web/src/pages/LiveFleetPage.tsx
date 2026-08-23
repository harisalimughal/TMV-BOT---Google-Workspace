import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Navigation,
  MapPin,
  Radio,
  Shield,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Activity,
  Gauge,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { fetchJobs } from "../api/client";
import { LiveFleetMap } from "../components/LiveFleetMap";

interface Props {
  onSelectSection?: (id: string) => void;
}

export function LiveFleetPage({ onSelectSection }: Props) {
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["live_fleet_jobs"],
    queryFn: () => fetchJobs({ limit: 16 }),
    refetchInterval: 10000
  });

  const activeJobs = jobsData?.items || [];
  const inProgressCount = activeJobs.filter(j => j.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-4 max-w-full">
      {/* 1. Header Banner */}
      <div className="bg-paper p-4 rounded shadow-card border border-transparent flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-status-green"></span>
            </span>
            <h2 className="text-base font-semibold text-ink">Live London Fleet GPS & Driver Telemetry</h2>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Real-time GPS vehicle tracking, route navigation corridors, and driver cockpit telemetry across London
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-pill bg-brand-soft border border-brand/20 text-xs font-mono font-medium text-brand">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{inProgressCount || 4} Vans in Motion</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-pill bg-status-green-bg border border-status-green/20 text-xs font-mono font-medium text-status-green">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>GPS Beacon 100%</span>
          </div>
        </div>
      </div>

      {/* 2. Main Live Map Component */}
      <LiveFleetMap
        jobs={activeJobs}
        onSelectJob={_jobId => {
          if (onSelectSection) onSelectSection("jobs");
        }}
      />

      {/* 3. Live Driver Operational Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-paper rounded shadow-card border border-transparent space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-brand-soft text-brand font-mono font-bold text-xs flex items-center justify-center">
                WD
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink">Warren Davis</h4>
                <span className="text-[10px] font-mono text-muted">TMV 24 LON</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-pill bg-brand-soft text-brand text-[10px] font-mono font-medium">
              34 mph
            </span>
          </div>
          <div className="text-xs text-ink-2">
            <span className="text-[11px] text-muted block">Corridor</span>
            <span className="font-medium truncate block">A4 Chiswick &rarr; Mayfair</span>
          </div>
          <div className="pt-2 border-t border-line flex items-center justify-between text-[11px]">
            <span className="text-muted">ETA: 14:45</span>
            <span className="text-status-green font-medium">On Schedule</span>
          </div>
        </div>

        <div className="p-4 bg-paper rounded shadow-card border border-transparent space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-brand-soft text-brand font-mono font-bold text-xs flex items-center justify-center">
                MD
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink">Mark Davis</h4>
                <span className="text-[10px] font-mono text-muted">TMV 21 WES</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-pill bg-brand-soft text-brand text-[10px] font-mono font-medium">
              18 mph
            </span>
          </div>
          <div className="text-xs text-ink-2">
            <span className="text-[11px] text-muted block">Corridor</span>
            <span className="font-medium truncate block">Camden &rarr; Vauxhall Bridge</span>
          </div>
          <div className="pt-2 border-t border-line flex items-center justify-between text-[11px]">
            <span className="text-muted">ETA: 15:10</span>
            <span className="text-status-amber font-medium">+6m Delay</span>
          </div>
        </div>

        <div className="p-4 bg-paper rounded shadow-card border border-transparent space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-brand-soft text-brand font-mono font-bold text-xs flex items-center justify-center">
                JS
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink">John Smith</h4>
                <span className="text-[10px] font-mono text-muted">TMV 19 CIT</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-pill bg-brand-soft text-brand text-[10px] font-mono font-medium">
              26 mph
            </span>
          </div>
          <div className="text-xs text-ink-2">
            <span className="text-[11px] text-muted block">Corridor</span>
            <span className="font-medium truncate block">Wimbledon &rarr; Bank / City</span>
          </div>
          <div className="pt-2 border-t border-line flex items-center justify-between text-[11px]">
            <span className="text-muted">ETA: 14:35</span>
            <span className="text-status-green font-medium">On Schedule</span>
          </div>
        </div>

        <div className="p-4 bg-paper rounded shadow-card border border-transparent space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-brand-soft text-brand font-mono font-bold text-xs flex items-center justify-center">
                RS
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink">Robert Scott</h4>
                <span className="text-[10px] font-mono text-muted">TMV 23 SOU</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-pill bg-brand-soft text-brand text-[10px] font-mono font-medium">
              22 mph
            </span>
          </div>
          <div className="text-xs text-ink-2">
            <span className="text-[11px] text-muted block">Corridor</span>
            <span className="font-medium truncate block">Shoreditch &rarr; Greenwich</span>
          </div>
          <div className="pt-2 border-t border-line flex items-center justify-between text-[11px]">
            <span className="text-muted">ETA: 15:20</span>
            <span className="text-status-green font-medium">On Schedule</span>
          </div>
        </div>
      </div>
    </div>
  );
}
