import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
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
  Minimize2,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  User,
  Phone,
  Copy,
  Check,
  Eye,
  Activity,
  Gauge,
  RotateCcw
} from "lucide-react";
import { NormalizedJob } from "../types";

interface Props {
  jobs: NormalizedJob[];
  onSelectJob?: (jobId: string) => void;
}

interface FleetVehicle {
  id: string;
  name: string;
  driver: string;
  driverInitials: string;
  vehicleModel: string;
  regPlate: string;
  zone: string;
  speedMph: number;
  headingDeg: number;
  progressPct: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: [number, number]; // [lat, lng]
  dropoffCoords: [number, number];
  routeWaypoints: [number, number][];
  currentCoords: [number, number];
  currentWaypointIdx: number;
  status: "IN_PROGRESS" | "READY" | "COMPLETED";
  delayMinutes: number;
  activeStatusText: string;
}

// Actual authentic London coordinates & street routes
const LONDON_ROUTES: Array<{
  pickupCoords: [number, number];
  dropoffCoords: [number, number];
  waypoints: [number, number][];
  speedBase: number;
  heading: number;
  statusText: string;
}> = [
  {
    // Route 1: Kensington to Canary Wharf via Piccadilly, Strand & Tower Hill
    pickupCoords: [51.4988, -0.1749], // Kensington SW7
    dropoffCoords: [51.5054, -0.0235], // Canary Wharf E14
    waypoints: [
      [51.4988, -0.1749],
      [51.5015, -0.1585], // Knightsbridge
      [51.5042, -0.1432], // Hyde Park Corner
      [51.5090, -0.1340], // Piccadilly Circus
      [51.5115, -0.1200], // Covent Garden
      [51.5135, -0.1000], // St Paul's Cathedral
      [51.5085, -0.0760], // Tower of London
      [51.5120, -0.0520], // Limehouse
      [51.5054, -0.0235]  // Canary Wharf
    ],
    speedBase: 24,
    heading: 85,
    statusText: "Cruising along Embankment corridor"
  },
  {
    // Route 2: Camden to Clapham via Tottenham Court Rd & Vauxhall Bridge
    pickupCoords: [51.5364, -0.1426], // Camden NW1
    dropoffCoords: [51.4623, -0.1583], // Clapham SW4
    waypoints: [
      [51.5364, -0.1426],
      [51.5245, -0.1340], // Euston
      [51.5170, -0.1300], // Tottenham Court Rd
      [51.5030, -0.1250], // Westminster / Whitehall
      [51.4920, -0.1240], // Millbank
      [51.4860, -0.1245], // Vauxhall Bridge
      [51.4740, -0.1420], // Stockwell
      [51.4623, -0.1583]  // Clapham Common
    ],
    speedBase: 19,
    heading: 180,
    statusText: "Crossing Vauxhall Bridge south"
  },
  {
    // Route 3: Heathrow M4 Corridor to Mayfair via Chiswick Flyover & A4
    pickupCoords: [51.4700, -0.4543], // Heathrow TW6
    dropoffCoords: [51.5098, -0.1480], // Mayfair W1
    waypoints: [
      [51.4700, -0.4543],
      [51.4880, -0.3200], // Brentford / M4
      [51.4925, -0.2750], // Chiswick Flyover A4
      [51.4940, -0.2200], // Hammersmith Flyover
      [51.4975, -0.1980], // Earl's Court
      [51.5020, -0.1600], // Knightsbridge
      [51.5098, -0.1480]  // Mayfair
    ],
    speedBase: 36,
    heading: 70,
    statusText: "In Transit on A4 Chiswick Flyover"
  },
  {
    // Route 4: Shoreditch to Greenwich via Rotherhithe Tunnel & Deptford
    pickupCoords: [51.5230, -0.0780], // Shoreditch E1
    dropoffCoords: [51.4826, 0.0077],  // Greenwich SE10
    waypoints: [
      [51.5230, -0.0780],
      [51.5160, -0.0650], // Whitechapel
      [51.5075, -0.0480], // Rotherhithe Tunnel Approach
      [51.4970, -0.0460], // Surrey Quays
      [51.4840, -0.0250], // Deptford Bridge
      [51.4826, 0.0077]   // Greenwich Park
    ],
    speedBase: 22,
    heading: 140,
    statusText: "Approaching Rotherhithe Thames corridor"
  },
  {
    // Route 5: Wimbledon to City of London via Wandsworth & Battersea
    pickupCoords: [51.4214, -0.2064], // Wimbledon SW19
    dropoffCoords: [51.5135, -0.0890], // Bank / City EC2
    waypoints: [
      [51.4214, -0.2064],
      [51.4550, -0.1900], // Wandsworth A3
      [51.4720, -0.1700], // Battersea Bridge
      [51.4880, -0.1480], // Chelsea Embankment
      [51.5050, -0.1150], // Blackfriars
      [51.5135, -0.0890]  // Bank
    ],
    speedBase: 27,
    heading: 45,
    statusText: "In Transit A3 towards City"
  },
  {
    // Route 6: Stratford to Hampstead via Islington & Camden
    pickupCoords: [51.5430, -0.0024], // Stratford E20
    dropoffCoords: [51.5550, -0.1750], // Hampstead NW3
    waypoints: [
      [51.5430, -0.0024],
      [51.5460, -0.0550], // Hackney Central
      [51.5440, -0.1020], // Highbury & Islington
      [51.5400, -0.1420], // Camden Town
      [51.5550, -0.1750]  // Hampstead
    ],
    speedBase: 20,
    heading: 290,
    statusText: "In Transit along A1203 corridor"
  },
  {
    // Route 7: Westminster to Bromley
    pickupCoords: [51.4990, -0.1280], // Westminster SW1
    dropoffCoords: [51.4060, 0.0150],  // Bromley BR1
    waypoints: [
      [51.4990, -0.1280],
      [51.4990, -0.1280], // Loading
      [51.4850, -0.1100], // Kennington
      [51.4060, 0.0150]
    ],
    speedBase: 0,
    heading: 0,
    statusText: "Loading at Pickup SW1"
  },
  {
    // Route 8: City of London to Ealing (Delivered)
    pickupCoords: [51.5150, -0.0900],
    dropoffCoords: [51.5130, -0.3050],
    waypoints: [
      [51.5130, -0.3050],
      [51.5130, -0.3050]
    ],
    speedBase: 0,
    heading: 0,
    statusText: "Delivered · Signature Recorded"
  }
];

const VEHICLE_CATALOG: Record<string, { model: string; reg: string; color: string }> = {
  WD: { model: "Mercedes Sprinter LWB 315", reg: "TMV 24 LON", color: "#1B75BC" },
  MD: { model: "Luton Box Van 3.5T Hydraulic", reg: "TMV 21 WES", color: "#29ABE2" },
  JS: { model: "Mercedes Sprinter 314 High Roof", reg: "TMV 19 CIT", color: "#067647" },
  RS: { model: "Ford Transit Custom EcoBlue", reg: "TMV 23 SOU", color: "#B54708" },
  UN: { model: "TMV Transit Delivery Van", reg: "TMV 22 FLE", color: "#475467" }
};

export function LiveFleetMap({ jobs, onSelectJob }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const ulezCircleRef = useRef<L.Circle | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "IN_PROGRESS" | "READY" | "COMPLETED">("ALL");
  const [mapTheme, setMapTheme] = useState<"voyager" | "light" | "osm">("voyager");
  const [showUlez, setShowUlez] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [liveLog, setLiveLog] = useState<string[]>([
    "Fleet telemetry link established with London base",
    "ULEZ congestion corridor tracking online",
    "All 8 active vehicle beacons synchronized"
  ]);

  // Generate initial fleet vehicles
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(() => {
    return jobs.slice(0, 8).map((job, idx) => {
      const route = LONDON_ROUTES[idx % LONDON_ROUTES.length];
      const initials = job.driverInitials || "WD";
      const spec = VEHICLE_CATALOG[initials] || VEHICLE_CATALOG.UN;

      const isCompleted = job.status === "COMPLETED";
      const isReady = job.status === "READY";

      const currentIdx = isCompleted ? route.waypoints.length - 1 : isReady ? 0 : Math.min(2 + (idx % 4), route.waypoints.length - 1);
      const currentCoords = route.waypoints[currentIdx];

      return {
        id: job.jobId,
        name: job.customerName,
        driver: job.driverName,
        driverInitials: initials,
        vehicleModel: spec.model,
        regPlate: spec.reg,
        zone: job.pickup.includes("SW")
          ? "South West London"
          : job.pickup.includes("NW")
          ? "North West London"
          : job.pickup.includes("EC") || job.pickup.includes("WC")
          ? "Central London (ULEZ)"
          : "Greater London Area",
        speedMph: isCompleted || isReady ? 0 : route.speedBase + (Math.floor(Math.random() * 5) - 2),
        headingDeg: route.heading,
        progressPct: isCompleted ? 100 : isReady ? 0 : Math.round((currentIdx / (route.waypoints.length - 1)) * 100),
        pickupAddress: job.pickup,
        dropoffAddress: job.dropoff,
        pickupCoords: route.pickupCoords,
        dropoffCoords: route.dropoffCoords,
        routeWaypoints: route.waypoints,
        currentCoords,
        currentWaypointIdx: currentIdx,
        status: job.status as any,
        delayMinutes: job.delayMinutes,
        activeStatusText: isCompleted ? "Delivered · Finished" : isReady ? "Scheduled at Yard" : route.statusText
      };
    });
  });

  // 1. Initialize Real Leaflet Interactive Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Central London [51.5074, -0.1278] at zoom 12
    const map = L.map(mapContainerRef.current, {
      center: [51.5074, -0.1278],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    // CartoDB Voyager / Positron Tile Layer (Ultra-clean modern SaaS map)
    const tileUrls = {
      voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    };

    const tileLayer = L.tileLayer(tileUrls[mapTheme], {
      maxZoom: 19,
      subdomains: "abcd"
    }).addTo(map);

    // London ULEZ Boundary Circle (Central London ~10km radius)
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
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });

    L.tileLayer(tileUrls[mapTheme], {
      maxZoom: 19,
      subdomains: "abcd"
    }).addTo(mapInstanceRef.current);
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

  // 2. Real-Time Moving GPS Simulation Loop (Every 2.5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles(prevVehicles => {
        return prevVehicles.map(veh => {
          if (veh.status !== "IN_PROGRESS") return veh;

          const totalWp = veh.routeWaypoints.length;
          let nextIdx = (veh.currentWaypointIdx + 1) % totalWp;
          if (nextIdx === 0) nextIdx = 1; // loop back to first driving waypoint

          const nextCoord = veh.routeWaypoints[nextIdx];
          const newSpeed = Math.max(15, Math.min(38, veh.speedMph + (Math.floor(Math.random() * 7) - 3)));
          const progress = Math.round((nextIdx / (totalWp - 1)) * 100);

          return {
            ...veh,
            currentWaypointIdx: nextIdx,
            currentCoords: nextCoord,
            speedMph: newSpeed,
            progressPct: progress
          };
        });
      });
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  // Filtered vehicles
  const visibleVehicles = useMemo(() => {
    if (activeFilter === "ALL") return vehicles;
    return vehicles.filter(v => v.status === activeFilter);
  }, [vehicles, activeFilter]);

  const activeSelected = useMemo(() => {
    if (!selectedId) return visibleVehicles[0] || vehicles[0] || null;
    return vehicles.find(v => v.id === selectedId) || visibleVehicles[0] || null;
  }, [selectedId, visibleVehicles, vehicles]);

  // 3. Sync Leaflet Markers and Selected Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    // Clear previous route polyline
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Render vehicle markers
    visibleVehicles.forEach(veh => {
      const isSelected = activeSelected?.id === veh.id;
      const isLate = veh.delayMinutes > 0;
      const isInTransit = veh.status === "IN_PROGRESS";

      const pinColor = veh.status === "COMPLETED" ? "#067647" : isLate ? "#B42318" : isSelected ? "#1B75BC" : "#101828";
      const bgPill = isSelected ? "#1B75BC" : "#FFFFFF";
      const textColor = isSelected ? "#FFFFFF" : pinColor;

      // Custom HTML Marker Element with Live Ping
      const customIcon = L.divIcon({
        className: "van-marker-container",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            ${isInTransit ? `<div class="animate-pulse-beacon" style="position: absolute; top: -4px; left: -4px; width: 36px; height: 36px; border-radius: 999px; background: ${pinColor}; opacity: 0.35;"></div>` : ""}
            
            <div style="
              width: 28px; 
              height: 28px; 
              border-radius: 999px; 
              background: ${bgPill}; 
              border: 2px solid ${pinColor}; 
              box-shadow: 0 4px 12px rgba(16,24,40,0.25);
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-family: 'IBM Plex Mono', monospace; 
              font-weight: 700; 
              font-size: 10px; 
              color: ${textColor};
              z-index: 10;
              transition: transform 0.2s ease;
            ">
              ${veh.driverInitials}
            </div>

            <div style="
              margin-top: -3px;
              width: 0; 
              height: 0; 
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${pinColor};
            "></div>

            <div style="
              margin-top: 2px;
              padding: 1px 5px;
              background: rgba(16, 24, 40, 0.85);
              backdrop-filter: blur(4px);
              border-radius: 4px;
              color: #ffffff;
              font-family: 'IBM Plex Mono', monospace;
              font-size: 8px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            ">
              ${veh.speedMph > 0 ? `${veh.speedMph} mph` : veh.status === "COMPLETED" ? "Delivered" : "Standby"}
            </div>
          </div>
        `,
        iconSize: [28, 48],
        iconAnchor: [14, 34]
      });

      const marker = L.marker(veh.currentCoords, { icon: customIcon }).addTo(map);

      marker.on("click", () => {
        setSelectedId(veh.id);
        if (onSelectJob) onSelectJob(veh.id);
      });

      markersRef.current[veh.id] = marker;
    });

    // Draw active selected vehicle route polyline & destination pins
    if (activeSelected && showRoutes) {
      // Route Polyline
      const poly = L.polyline(activeSelected.routeWaypoints, {
        color: "#1B75BC",
        weight: 4,
        opacity: 0.85,
        dashArray: "8, 8",
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);

      polylineRef.current = poly;
    }
  }, [visibleVehicles, activeSelected, showRoutes, onSelectJob]);

  // Center on Selected Van
  const handleFocusVehicle = (veh: FleetVehicle) => {
    setSelectedId(veh.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(veh.currentCoords, 14, {
        animate: true,
        duration: 1.2
      });
    }
  };

  // Fit all fleet bounds
  const handleFitAllFleet = () => {
    if (!mapInstanceRef.current || visibleVehicles.length === 0) return;
    const latLngs = visibleVehicles.map(v => v.currentCoords);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

  const handleCopyPostcode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div
      className={`bg-paper border border-line rounded shadow-card overflow-hidden text-ink transition-all ${
        isFullscreen ? "fixed inset-4 z-50 flex flex-col shadow-pop" : "relative"
      }`}
    >
      {/* 1. TOP MASTER TOOLBAR */}
      <div className="p-3.5 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-paper">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-status-green"></span>
            </span>
            <h3 className="text-sm font-semibold text-ink">Live London Fleet GPS</h3>
          </div>
          <span className="hidden sm:inline-block h-4 w-px bg-line" />
          <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
            <Radio className="w-3.5 h-3.5 text-brand animate-pulse" />
            <span>
              {vehicles.filter(v => v.status === "IN_PROGRESS").length} in transit &bull; Live London Telemetry
            </span>
          </div>
        </div>

        {/* Filters & Map Settings */}
        <div className="flex items-center gap-2">
          {/* Status Filter Segmented Control */}
          <div className="flex items-center p-0.5 bg-surface rounded border border-line text-xs font-medium">
            {(
              [
                { id: "ALL", label: `All (${vehicles.length})` },
                { id: "IN_PROGRESS", label: "In Transit" },
                { id: "READY", label: "Scheduled" },
                { id: "COMPLETED", label: "Finished" }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  activeFilter === tab.id
                    ? "bg-paper text-ink shadow-card font-semibold"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Map Layer Switcher */}
          <select
            value={mapTheme}
            onChange={e => setMapTheme(e.target.value as any)}
            className="h-8 px-2 bg-surface border border-line rounded text-xs text-ink font-medium"
            title="Switch Map Tile Theme"
          >
            <option value="voyager">Navigation (Voyager)</option>
            <option value="light">Clean Positron</option>
            <option value="osm">OpenStreetMap</option>
          </select>

          {/* ULEZ Toggle */}
          <button
            onClick={() => setShowUlez(!showUlez)}
            className={`px-2.5 py-1.5 rounded border text-xs font-medium transition ${
              showUlez ? "bg-brand-soft border-brand/30 text-brand" : "bg-surface border-line text-muted"
            }`}
            title="Toggle London ULEZ Boundary"
          >
            ULEZ
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded border border-line bg-surface hover:bg-surface-2 text-ink-2 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map View"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. REAL INTERACTIVE LEAFLET MAP + TELEMETRY SIDECAR */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${isFullscreen ? "flex-1 min-h-0" : "min-h-[500px]"}`}>
        {/* LEAFLET MAP CANVAS (8 Columns) */}
        <div className="lg:col-span-8 relative bg-surface border-b lg:border-b-0 lg:border-r border-line overflow-hidden">
          {/* FLOATING MAP CONTROLS (Top-Right) */}
          <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5 bg-paper/95 backdrop-blur-xs p-1 rounded shadow-card border border-transparent">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="p-1.5 rounded hover:bg-surface text-ink transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="p-1.5 rounded hover:bg-surface text-ink transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFitAllFleet}
              className="p-1.5 rounded hover:bg-surface text-ink transition"
              title="Fit All Active Vans"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* LEAFLET DOM CONTAINER */}
          <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />
        </div>

        {/* 3. REAL-TIME FLEET TELEMETRY & DISPATCH SIDECAR (4 Columns) */}
        <div className="lg:col-span-4 bg-paper p-5 flex flex-col justify-between overflow-y-auto">
          {activeSelected ? (
            <div className="space-y-4">
              {/* Driver Identity Card */}
              <div className="flex items-start justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-brand-soft text-brand font-mono font-bold text-sm flex items-center justify-center border border-brand/20 shadow-card">
                    {activeSelected.driverInitials}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-ink leading-tight flex items-center gap-1.5">
                      {activeSelected.driver}
                    </h4>
                    <span className="text-xs font-mono text-muted">{activeSelected.regPlate}</span>
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

              {/* Status & Velocity Meters */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-surface rounded border border-line">
                  <span className="text-[11px] text-muted block mb-1">Vehicle Model</span>
                  <span className="font-semibold text-ink text-xs truncate block">{activeSelected.vehicleModel}</span>
                  <span className="text-[10px] text-muted block mt-0.5">{activeSelected.zone}</span>
                </div>

                <div className="p-3 bg-surface rounded border border-line flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted block">Live Velocity</span>
                    <Activity className="w-3.5 h-3.5 text-brand animate-pulse" />
                  </div>
                  <span className="text-lg font-bold font-mono text-ink mt-1">
                    {activeSelected.speedMph} <span className="text-xs font-normal text-muted">mph</span>
                  </span>
                  <span className="text-[10px] text-status-green font-medium">GPS Signal 100%</span>
                </div>
              </div>

              {/* Corridor Route Progression */}
              <div className="p-3 bg-surface rounded border border-line space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted">Route Progression</span>
                  <span className="text-[11px] font-mono text-brand font-semibold">
                    {activeSelected.progressPct}% Complete
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${activeSelected.progressPct}%` }}
                  />
                </div>

                {/* Pickup & Dropoff Addresses */}
                <div className="space-y-2 pt-1 font-mono text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-pill bg-status-green-bg text-status-green flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                      A
                    </span>
                    <div className="overflow-hidden">
                      <span className="text-muted text-[10px] block font-sans">Origin Pickup</span>
                      <span className="text-ink truncate block" title={activeSelected.pickupAddress}>
                        {activeSelected.pickupAddress}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-pill bg-brand-soft text-brand flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                      B
                    </span>
                    <div className="overflow-hidden">
                      <span className="text-muted text-[10px] block font-sans">Destination Dropoff</span>
                      <span className="text-ink truncate block" title={activeSelected.dropoffAddress}>
                        {activeSelected.dropoffAddress}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Move Details & Customer */}
              <div className="p-3 bg-paper rounded border border-line flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] text-muted block">Client Move</span>
                  <span className="font-semibold text-ink">{activeSelected.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-muted block">Job ID</span>
                  <span className="font-mono font-semibold text-brand">{activeSelected.id}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {onSelectJob && (
                  <button
                    onClick={() => onSelectJob(activeSelected.id)}
                    className="flex-1 h-8 rounded bg-brand text-white text-xs font-medium hover:bg-brand-dark transition flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Move</span>
                  </button>
                )}
                <button
                  onClick={() => handleCopyPostcode(activeSelected.pickupAddress)}
                  className="h-8 px-3 rounded border border-line bg-surface hover:bg-surface-2 text-xs font-medium text-ink-2 transition flex items-center gap-1"
                  title="Copy Pickup Postcode"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-status-green" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 text-muted">
              <Compass className="w-10 h-10 text-muted mb-3 opacity-40 animate-spin-slow" />
              <h4 className="text-xs font-semibold text-ink">London Fleet Radar Active</h4>
              <p className="text-[11px] text-muted mt-1 max-w-[200px]">
                Click on any vehicle marker on the map to track live GPS telemetry and route navigation.
              </p>
            </div>
          )}

          {/* Quick Active Vans Roster (Bottom Carousel) */}
          <div className="pt-3 mt-3 border-t border-line">
            <span className="text-[11px] font-medium text-muted block mb-2">
              London Vans ({vehicles.length}) &bull; Click to track
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {vehicles.map(veh => {
                const isSelected = activeSelected?.id === veh.id;
                return (
                  <button
                    key={veh.id}
                    onClick={() => handleFocusVehicle(veh)}
                    className={`px-2 py-1 rounded text-xs font-mono font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
                      isSelected
                        ? "bg-brand text-white shadow-card"
                        : "bg-surface border border-line text-ink-2 hover:bg-surface-2"
                    }`}
                  >
                    <span>{veh.driverInitials}</span>
                    <span className="text-[10px] opacity-75">{veh.speedMph}mph</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
