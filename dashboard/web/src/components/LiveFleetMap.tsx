import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import {
  Radio,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Truck,
  ArrowUpRight,
  Copy,
  Check,
  Eye,
  Activity,
  Compass,
  RotateCcw,
  WifiOff
} from "lucide-react";
import { NormalizedJob } from "../types";
import { fetchLiveFleet } from "../api/client";

interface Props {
  jobs: NormalizedJob[];
  onSelectJob?: (jobId: string) => void;
}

interface FleetVehicle {
  imei: string;
  plateNumber: string;
  driverInitials: string;
  driverName: string;
  matched: boolean;
  lat: number;
  lng: number;
  speedMph: number;
  lastUpdate: string;
  isStale: boolean;
  isMoving: boolean;
  currentJob: NormalizedJob | null;
}

type FilterId = "ALL" | "MOVING" | "IDLE" | "OFFLINE";

/** A device stops reporting for various real reasons (parked in a basement, ignition
 * off long enough to sleep, SIM issue) -- 10 minutes without an update means "don't
 * trust this position", not "the van doesn't exist". */
const STALE_AFTER_MINUTES = 10;

function relativeTime(dtTracker: string): string {
  const dt = DateTime.fromSQL(dtTracker, { zone: "utc" });
  if (!dt.isValid) return dtTracker;
  const minutes = DateTime.utc().diff(dt, "minutes").minutes;
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function LiveFleetMap({ jobs, onSelectJob }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const hasFitBoundsRef = useRef(false);
  const ulezCircleRef = useRef<L.Circle | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>("ALL");
  const [mapTheme, setMapTheme] = useState<"voyager" | "light" | "osm">("voyager");
  const [showUlez, setShowUlez] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const { data: fleetData, dataUpdatedAt } = useQuery({
    queryKey: ["fleet_live"],
    queryFn: fetchLiveFleet,
    refetchInterval: 10000
  });

  // Real device positions from GPSLive, cross-referenced with today's IN_PROGRESS jobs
  // so a matched driver's current move shows alongside their position.
  const vehicles: FleetVehicle[] = useMemo(() => {
    return (fleetData?.vehicles || []).map(v => {
      const dt = DateTime.fromSQL(v.lastUpdate, { zone: "utc" });
      const minutesAgo = dt.isValid ? DateTime.utc().diff(dt, "minutes").minutes : Infinity;
      const isStale = minutesAgo > STALE_AFTER_MINUTES;
      const currentJob = v.driverInitials
        ? jobs.find(j => j.driverInitials === v.driverInitials && j.status === "IN_PROGRESS") || null
        : null;

      return {
        imei: v.imei,
        plateNumber: v.plateNumber,
        driverInitials: v.driverInitials || "??",
        driverName: v.driverName || v.plateNumber || "Unidentified vehicle",
        matched: !!v.driverInitials,
        lat: v.lat,
        lng: v.lng,
        speedMph: v.speedMph,
        lastUpdate: v.lastUpdate,
        isStale,
        isMoving: !isStale && v.speedMph > 2,
        currentJob
      };
    });
  }, [fleetData, jobs]);

  // 1. Initialize Real Leaflet Interactive Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [51.5074, -0.1278],
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    const tileUrls = {
      voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    };

    L.tileLayer(tileUrls[mapTheme], { maxZoom: 19, subdomains: "abcd" }).addTo(map);

    const ulez = L.circle([51.5074, -0.1278], {
      radius: 9500,
      color: "#1B75BC",
      weight: 1.5,
      dashArray: "6, 6",
      fillColor: "#1B75BC",
      fillOpacity: 0.03
    }).addTo(map);

    ulezCircleRef.current = ulez;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map tile theme
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const tileUrls = {
      voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    };
    mapInstanceRef.current.eachLayer(layer => {
      if (layer instanceof L.TileLayer) mapInstanceRef.current?.removeLayer(layer);
    });
    L.tileLayer(tileUrls[mapTheme], { maxZoom: 19, subdomains: "abcd" }).addTo(mapInstanceRef.current);
  }, [mapTheme]);

  // Toggle ULEZ
  useEffect(() => {
    if (!ulezCircleRef.current || !mapInstanceRef.current) return;
    if (showUlez) {
      ulezCircleRef.current.addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.removeLayer(ulezCircleRef.current);
    }
  }, [showUlez]);

  // Filtered vehicles
  const visibleVehicles = useMemo(() => {
    if (activeFilter === "ALL") return vehicles;
    if (activeFilter === "MOVING") return vehicles.filter(v => v.isMoving);
    if (activeFilter === "OFFLINE") return vehicles.filter(v => v.isStale);
    return vehicles.filter(v => !v.isStale && !v.isMoving); // IDLE
  }, [vehicles, activeFilter]);

  const activeSelected = useMemo(() => {
    if (!selectedId) return visibleVehicles[0] || null;
    return vehicles.find(v => v.imei === selectedId) || visibleVehicles[0] || null;
  }, [selectedId, visibleVehicles, vehicles]);

  // 2. Sync Leaflet Markers to real positions
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    visibleVehicles.forEach(veh => {
      const isSelected = activeSelected?.imei === veh.imei;
      const pinColor = veh.isStale ? "#98A2B3" : isSelected ? "#1B75BC" : veh.isMoving ? "#101828" : "#475467";
      const bgPill = isSelected ? "#1B75BC" : "#FFFFFF";
      const textColor = isSelected ? "#FFFFFF" : pinColor;

      const customIcon = L.divIcon({
        className: "van-marker-container",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            ${veh.isMoving ? `<div class="animate-pulse-beacon" style="position: absolute; top: -4px; left: -4px; width: 36px; height: 36px; border-radius: 999px; background: ${pinColor}; opacity: 0.35;"></div>` : ""}
            <div style="
              width: 28px; height: 28px; border-radius: 999px; background: ${bgPill};
              border: 2px solid ${pinColor}; box-shadow: 0 4px 12px rgba(16,24,40,0.25);
              display: flex; align-items: center; justify-content: center;
              font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 10px;
              color: ${textColor}; z-index: 10; opacity: ${veh.isStale ? 0.6 : 1};
            ">
              ${veh.driverInitials}
            </div>
            <div style="margin-top: -3px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${pinColor};"></div>
            <div style="
              margin-top: 2px; padding: 1px 5px; background: rgba(16, 24, 40, 0.85);
              border-radius: 4px; color: #ffffff; font-family: 'IBM Plex Mono', monospace;
              font-size: 8px; font-weight: 600; white-space: nowrap;
            ">
              ${veh.isStale ? "Offline" : veh.speedMph > 0 ? `${veh.speedMph} mph` : "Idle"}
            </div>
          </div>
        `,
        iconSize: [28, 48],
        iconAnchor: [14, 34]
      });

      const marker = L.marker([veh.lat, veh.lng], { icon: customIcon }).addTo(map);
      marker.on("click", () => setSelectedId(veh.imei));
      markersRef.current[veh.imei] = marker;
    });

    // Fit bounds once, the first time real positions arrive -- don't re-fit on every
    // 10s poll or the map would keep yanking the view while someone's looking at it.
    if (!hasFitBoundsRef.current && visibleVehicles.length > 0) {
      const bounds = L.latLngBounds(visibleVehicles.map(v => [v.lat, v.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
      hasFitBoundsRef.current = true;
    }
  }, [visibleVehicles, activeSelected]);

  const handleFocusVehicle = (veh: FleetVehicle) => {
    setSelectedId(veh.imei);
    mapInstanceRef.current?.flyTo([veh.lat, veh.lng], 14, { animate: true, duration: 1.2 });
  };

  const handleFitAllFleet = () => {
    if (!mapInstanceRef.current || visibleVehicles.length === 0) return;
    const bounds = L.latLngBounds(visibleVehicles.map(v => [v.lat, v.lng] as [number, number]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

  const handleCopyCoords = (veh: FleetVehicle) => {
    navigator.clipboard.writeText(`${veh.lat}, ${veh.lng}`);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const movingCount = vehicles.filter(v => v.isMoving).length;
  const offlineCount = vehicles.filter(v => v.isStale).length;

  return (
    <div
      className={`bg-paper border border-line rounded shadow-card overflow-hidden text-ink transition-all ${
        isFullscreen ? "fixed inset-4 z-50 flex flex-col shadow-pop" : "relative"
      }`}
    >
      {/* 1. TOP MASTER TOOLBAR */}
      <div className="p-3.5 border-b border-line flex flex-wrap items-center gap-3 bg-paper">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-status-green"></span>
          </span>
          <h3 className="text-btn text-ink whitespace-nowrap">Live Fleet GPS</h3>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted font-mono shrink-0">
          <Radio className="w-3.5 h-3.5 text-brand animate-pulse" />
          <span>{movingCount} in transit &bull; {vehicles.length} tracked</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
          <div className="flex items-center p-0.5 bg-surface rounded border border-line text-xs font-medium shrink-0">
            {(
              [
                { id: "ALL", label: `All (${vehicles.length})` },
                { id: "MOVING", label: "Moving" },
                { id: "IDLE", label: "Idle" },
                { id: "OFFLINE", label: `Offline (${offlineCount})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded transition text-xs ${
                  activeFilter === tab.id ? "bg-paper text-ink shadow-card font-semibold" : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={mapTheme}
            onChange={e => setMapTheme(e.target.value as any)}
            className="shrink-0 h-8 px-2 bg-surface border border-line rounded text-xs text-ink font-medium"
            title="Switch Map Tile Theme"
          >
            <option value="voyager">Navigation (Voyager)</option>
            <option value="light">Clean Positron</option>
            <option value="osm">OpenStreetMap</option>
          </select>

          <button
            onClick={() => setShowUlez(!showUlez)}
            className={`shrink-0 px-2.5 py-1.5 rounded border text-xs font-medium transition ${
              showUlez ? "bg-brand-soft border-brand/30 text-brand" : "bg-surface border-line text-muted"
            }`}
            title="Toggle London ULEZ Boundary"
          >
            ULEZ
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="shrink-0 p-1.5 rounded border border-line bg-surface hover:bg-surface-2 text-ink-2 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map View"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. REAL INTERACTIVE LEAFLET MAP + TELEMETRY SIDECAR */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${isFullscreen ? "flex-1 min-h-0" : "min-h-[500px]"}`}>
        <div className="lg:col-span-8 relative bg-surface border-b lg:border-b-0 lg:border-r border-line overflow-hidden">
          <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5 bg-paper/95 backdrop-blur-xs p-1 rounded border border-line shadow-card">
            <button onClick={() => mapInstanceRef.current?.zoomIn()} className="p-1.5 rounded hover:bg-surface text-ink transition" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => mapInstanceRef.current?.zoomOut()} className="p-1.5 rounded hover:bg-surface text-ink transition" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleFitAllFleet} className="p-1.5 rounded hover:bg-surface text-ink transition" title="Fit All Active Vans">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {vehicles.length === 0 && (
            <div className="absolute inset-0 z-[300] flex items-center justify-center bg-paper/80 backdrop-blur-xs">
              <div className="text-center px-6">
                <WifiOff className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <p className="text-[13px] font-semibold text-ink">No vehicle positions available</p>
                <p className="text-[11px] text-muted mt-1">Waiting for GPSLive telemetry...</p>
              </div>
            </div>
          )}

          <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />
        </div>

        {/* 3. REAL-TIME FLEET TELEMETRY SIDECAR */}
        <div className="lg:col-span-4 bg-paper p-5 flex flex-col justify-between overflow-y-auto">
          {activeSelected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded font-mono font-bold text-sm flex items-center justify-center border shadow-card ${
                    activeSelected.matched ? "bg-brand-soft text-brand border-brand/20" : "bg-surface text-muted border-line"
                  }`}>
                    {activeSelected.driverInitials}
                  </div>
                  <div>
                    <h4 className="text-btn text-ink leading-tight">{activeSelected.driverName}</h4>
                    <span className="text-xs font-mono text-muted">{activeSelected.plateNumber}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleFocusVehicle(activeSelected)}
                  className="px-2.5 py-1 rounded bg-brand-soft text-brand hover:bg-brand/20 text-xs font-medium transition flex items-center gap-1"
                  title="Center map on this vehicle"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Track</span>
                </button>
              </div>

              {!activeSelected.matched && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
                  This plate/device name didn't match any driver in the Drivers sheet.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-surface rounded border border-line flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted block">Live Speed</span>
                    {!activeSelected.isStale && <Activity className="w-3.5 h-3.5 text-brand animate-pulse" />}
                  </div>
                  <span className="text-lg font-bold font-mono text-ink mt-1">
                    {activeSelected.isStale ? "—" : activeSelected.speedMph}
                    {!activeSelected.isStale && <span className="text-xs font-normal text-muted"> mph</span>}
                  </span>
                  <span className={`text-[10px] font-medium ${activeSelected.isStale ? "text-status-red" : "text-status-green"}`}>
                    {activeSelected.isStale ? "Signal lost" : "GPS Live"}
                  </span>
                </div>

                <div className="p-3 bg-surface rounded border border-line">
                  <span className="text-[11px] text-muted block mb-1">Last Report</span>
                  <span className="font-semibold text-ink text-xs block">{relativeTime(activeSelected.lastUpdate)}</span>
                  <span className="text-[10px] text-muted block mt-0.5 font-mono">{activeSelected.lastUpdate} UTC</span>
                </div>
              </div>

              {/* Current job, if this driver has one IN_PROGRESS right now -- real data
                  cross-referenced from the Sheets-backed jobs list, not fabricated. */}
              {activeSelected.currentJob ? (
                <div className="p-3 bg-surface rounded border border-line space-y-2.5 text-xs">
                  <span className="text-[11px] font-medium text-muted">Current Job</span>
                  <div className="space-y-2 font-mono text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-pill bg-status-green-bg text-status-green flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">A</span>
                      <div className="overflow-hidden">
                        <span className="text-muted text-[10px] block font-sans">Pickup</span>
                        <span className="text-ink truncate block" title={activeSelected.currentJob.pickup}>{activeSelected.currentJob.pickup}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-pill bg-brand-soft text-brand flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">B</span>
                      <div className="overflow-hidden">
                        <span className="text-muted text-[10px] block font-sans">Dropoff</span>
                        <span className="text-ink truncate block" title={activeSelected.currentJob.dropoff}>{activeSelected.currentJob.dropoff}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between border-t border-line">
                    <span className="font-mono font-semibold text-brand">{activeSelected.currentJob.jobId}</span>
                    <span className="text-ink font-medium">{activeSelected.currentJob.customerName}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-surface rounded border border-line text-center text-[11px] text-muted">
                  No active job assigned right now
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {onSelectJob && activeSelected.currentJob && (
                  <button
                    onClick={() => onSelectJob(activeSelected.currentJob!.jobId)}
                    className="flex-1 h-8 rounded bg-brand text-white text-xs font-medium hover:bg-brand-dark transition flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Move</span>
                  </button>
                )}
                <button
                  onClick={() => handleCopyCoords(activeSelected)}
                  className="h-8 px-3 rounded border border-line bg-surface hover:bg-surface-2 text-xs font-medium text-ink-2 transition flex items-center gap-1"
                  title="Copy coordinates"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-status-green" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Coords</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 text-muted">
              <Truck className="w-10 h-10 text-muted mb-3 opacity-40" />
              <h4 className="text-btn text-ink">No vehicles to show</h4>
              <p className="text-[11px] text-muted mt-1 max-w-[200px]">
                {vehicles.length === 0
                  ? "Waiting for the first GPSLive position update."
                  : "Try a different filter above."}
              </p>
            </div>
          )}

          {vehicles.length > 0 && (
            <div className="pt-3 mt-3 border-t border-line">
              <span className="text-[11px] font-medium text-muted block mb-2">
                Fleet ({vehicles.length}) &bull; Click to track
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {vehicles.map(veh => {
                  const isSelected = activeSelected?.imei === veh.imei;
                  return (
                    <button
                      key={veh.imei}
                      onClick={() => handleFocusVehicle(veh)}
                      className={`px-2 py-1 rounded text-xs font-mono font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
                        isSelected ? "bg-brand text-white shadow-card" : "bg-surface border border-line text-ink-2 hover:bg-surface-2"
                      } ${veh.isStale ? "opacity-50" : ""}`}
                    >
                      <span>{veh.driverInitials}</span>
                      <span className="text-[10px] opacity-75">{veh.isStale ? "offline" : `${veh.speedMph}mph`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
