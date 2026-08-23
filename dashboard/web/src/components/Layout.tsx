import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Navigation,
  Truck,
  CheckSquare,
  LogIn,
  LogOut,
  AlertCircle,
  ShieldAlert,
  Users,
  Banknote,
  AlertTriangle,
  History,
  FileSpreadsheet,
  Settings,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  Sparkles,
  Command,
  HelpCircle,
  Sliders
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchExceptions, triggerDatasetRefresh } from "../api/client";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsModal } from "./ShortcutsModal";
import { LiveActivityTicker } from "./LiveActivityTicker";
import { formatLondonTimeOnly } from "../utils/date";

interface Props {
  activeSection: string;
  onSelectSection: (id: string) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

interface NavSectionItem {
  id?: string;
  label: string;
  icon?: any;
  type?: "header";
  hasBadge?: boolean;
  isLive?: boolean;
  desc?: string;
}

const NAV_CONFIG: NavSectionItem[] = [
  { type: "header", label: "Operations" },
  { id: "overview", label: "Overview", icon: LayoutDashboard, desc: "Executive KPI telemetry, revenue velocity and operational health" },
  { id: "live_fleet", label: "Live Fleet", icon: Navigation, isLive: true, desc: "Real-time London GPS vehicle tracking, route corridors and driver cockpit telemetry" },
  { id: "jobs", label: "Jobs", icon: Truck, desc: "Operational moves joined across Bookings, Drivers, Workflow and Evidence" },
  { id: "finished", label: "Finished Jobs", icon: CheckSquare, desc: "Completed moves audit with verified evidence and sign-off records" },
  { type: "header", label: "Scenarios" },
  { id: "checkin", label: "Check In", icon: LogIn, desc: "Storage facility entry logs and client container check-ins" },
  { id: "checkout", label: "Check Out", icon: LogOut, desc: "Storage retrieval and client drop-off confirmation records" },
  { id: "parking", label: "Parking Liability", icon: AlertCircle, desc: "Driver parking risk waivers and client location sign-offs" },
  { id: "liability", label: "Liability Report", icon: ShieldAlert, desc: "Vehicle or item damage categories with evidence photographs" },
  { type: "header", label: "Management" },
  { id: "drivers", label: "Drivers", icon: Users, desc: "Driver scorecards, revenue handled and punctuality metrics" },
  { id: "finance", label: "Finance", icon: Banknote, desc: "Reconciliation of Base Price, Extra Charges, Overtime and Payment Methods" },
  { id: "exceptions", label: "Exceptions", icon: AlertTriangle, hasBadge: true, desc: "Operational exceptions and quality control alerts" },
  { id: "activity", label: "Activity Log", icon: History, desc: "Chronological audit records directly from ActivityLog tab" },
  { id: "reports", label: "Reports", icon: FileSpreadsheet, desc: "Downloadable operational datasets and certified export files" },
  { id: "settings", label: "Settings", icon: Settings, desc: "Read-only system rules, rates, caching invariants and database mapping" }
];

export function Layout({ activeSection, onSelectSection, onLogout, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(formatLondonTimeOnly(new Date().toISOString()));
  const [londonClock, setLondonClock] = useState(formatLondonTimeOnly(new Date().toISOString()));
  const queryClient = useQueryClient();

  // Clock tick every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setLondonClock(formatLondonTimeOnly(new Date().toISOString()));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const { data: exData } = useQuery({
    queryKey: ["exceptions_badge"],
    queryFn: () => fetchExceptions(undefined, undefined, undefined, true),
    refetchInterval: 30000
  });

  const refreshMutation = useMutation({
    mutationFn: triggerDatasetRefresh,
    onSuccess: () => {
      setLastSyncTime(formatLondonTimeOnly(new Date().toISOString()));
      queryClient.invalidateQueries();
    }
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        refreshMutation.mutate();
      } else if (e.key === "o" || e.key === "O") {
        onSelectSection("overview");
      } else if (e.key === "l" || e.key === "L") {
        onSelectSection("live_fleet");
      } else if (e.key === "j" || e.key === "J") {
        onSelectSection("jobs");
      } else if (e.key === "d" || e.key === "D") {
        onSelectSection("drivers");
      } else if (e.key === "f" || e.key === "F") {
        onSelectSection("finance");
      } else if (e.key === "e" || e.key === "E") {
        onSelectSection("exceptions");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectSection, refreshMutation]);

  const rawBadgeCount = exData?.activeBadgeCount ?? exData?.total ?? 0;
  const exceptionsBadgeLabel = rawBadgeCount > 999 ? "999+" : rawBadgeCount > 99 ? "99+" : rawBadgeCount > 0 ? String(rawBadgeCount) : null;

  const currentNav = NAV_CONFIG.find(n => n.id === activeSection) || NAV_CONFIG[1];

  return (
    <div className="flex min-h-screen bg-bg text-ink selection:bg-brand-soft selection:text-brand font-sans antialiased">
      {/* 1. HIGH-TICKET SIDEBAR */}
      <aside
        className={`bg-paper text-ink flex flex-col justify-between border-r border-line transition-all duration-200 z-30 sticky top-0 h-screen shadow-sm ${
          collapsed ? "w-14" : "w-60"
        }`}
      >
        <div className="flex flex-col min-h-0">
          {/* Brand Header */}
          <div className="h-14 flex items-center justify-between px-3.5 border-b border-line bg-paper">
            {!collapsed && (
              <div className="flex items-center gap-2.5 overflow-hidden">
                <img
                  src="/tmv-mascot.png"
                  alt="The Man Van Mascot"
                  className="w-8 h-8 rounded-lg object-contain bg-surface border border-line p-0.5 shadow-2xs flex-shrink-0"
                />
                <div className="overflow-hidden">
                  <span className="font-bold text-xs tracking-tight text-brand block leading-tight truncate">
                    The Man Van
                  </span>
                  <span className="text-[10px] font-medium text-muted block leading-none truncate">
                    London Operations
                  </span>
                </div>
              </div>
            )}
            {collapsed && (
              <img
                src="/tmv-mascot.png"
                alt="TMV"
                className="w-7 h-7 rounded-lg object-contain bg-surface border border-line p-0.5 mx-auto shadow-2xs"
                title="The Man Van Operations"
              />
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded hover:bg-surface text-muted hover:text-ink transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-0.5 overflow-y-auto flex-1">
            {NAV_CONFIG.map((item, idx) => {
              if (item.type === "header") {
                if (collapsed) return <div key={idx} className="my-2 border-t border-line" />;
                return (
                  <div
                    key={idx}
                    className="pt-3 pb-1 px-2.5 text-[11px] font-semibold text-muted uppercase tracking-wider"
                  >
                    {item.label}
                  </div>
                );
              }

              const Icon = item.icon!;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSection(item.id!)}
                  className={`w-full h-9 flex items-center gap-2.5 px-2.5 rounded-lg text-xs font-medium transition group relative ${
                    isActive
                      ? "bg-brand-soft text-brand font-semibold shadow-card"
                      : "text-ink-2 hover:bg-surface hover:text-ink"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  {/* 2px active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-brand rounded-full" />
                  )}

                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-transform ${
                      isActive ? "text-brand scale-105" : "text-muted group-hover:text-ink-2"
                    }`}
                  />

                  {!collapsed && <span className="truncate">{item.label}</span>}

                  {/* Live Beacon Pill */}
                  {!collapsed && item.isLive && (
                    <span className="ml-auto flex items-center gap-1 px-1.5 py-0.2 rounded-pill bg-status-green-bg text-status-green text-[9px] font-mono font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-ping" />
                      LIVE
                    </span>
                  )}

                  {/* Exception Badge */}
                  {!collapsed && item.hasBadge && exceptionsBadgeLabel && (
                    <span className="ml-auto px-1.5 py-0.2 rounded-pill bg-status-red-bg text-status-red text-[10px] font-bold font-mono">
                      {exceptionsBadgeLabel}
                    </span>
                  )}

                  {collapsed && item.isLive && (
                    <span className="w-2 h-2 rounded-full bg-status-green absolute right-2 ring-2 ring-paper" />
                  )}
                  {collapsed && item.hasBadge && exceptionsBadgeLabel && (
                    <span className="w-2 h-2 rounded-full bg-status-red absolute right-2 ring-2 ring-paper" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom context block */}
        <div className="p-3 border-t border-line bg-paper flex items-center justify-between text-xs text-ink-2">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-surface border border-line flex items-center justify-center font-mono font-bold text-[10px] text-ink">
                  AD
                </div>
                <div className="overflow-hidden">
                  <span className="font-medium text-ink truncate block text-xs">Admin Console</span>
                  <span className="text-[10px] text-muted block font-mono">London &bull; {londonClock}</span>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-xs text-muted hover:text-status-red font-medium transition"
                  title="Sign out"
                >
                  Log out
                </button>
              )}
            </>
          ) : (
            onLogout && (
              <button
                onClick={onLogout}
                className="w-full py-1 text-center text-muted hover:text-status-red"
                title="Log out"
              >
                <LogOut className="w-4 h-4 mx-auto" />
              </button>
            )
          )}
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 2. HIGH-TICKET 60PX HEADER */}
        <header className="h-[60px] bg-paper/95 backdrop-blur-md border-b border-line px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          {/* Left: Page Title & Subtitle */}
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-bold text-ink leading-tight tracking-tight">
              {currentNav.label}
            </h1>
            <p className="text-xs text-muted leading-tight truncate max-w-lg hidden sm:block">
              {currentNav.desc}
            </p>
          </div>

          {/* Centre: Search input */}
          <div className="relative hidden md:block w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs, customers, postcodes..."
              onClick={() => setPaletteOpen(true)}
              readOnly
              className="w-full h-9 pl-9 pr-10 bg-surface border border-line-strong rounded-lg text-xs text-ink placeholder:text-muted focus:bg-paper cursor-pointer transition shadow-2xs"
            />
            <kbd className="absolute right-2.5 top-2 px-1.5 py-0.5 text-[10px] font-mono text-muted bg-paper border border-line rounded shadow-2xs">
              ⌘K
            </kbd>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3 text-xs">
            {/* Live Clock & Sync indicator */}
            <div className="flex items-center gap-2 text-muted text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-surface border border-line text-ink text-[11px] font-medium hidden sm:inline">
                {londonClock} BST
              </span>
              <button
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="p-1.5 rounded-lg hover:bg-surface text-ink-2 transition border border-transparent hover:border-line"
                title="Sync live sheets data (R)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? "animate-spin text-brand" : "text-muted"}`} />
              </button>
            </div>

            <span className="h-4 w-px bg-line" />

            {/* Shortcuts Guide Button */}
            <button
              onClick={() => setShortcutsOpen(true)}
              className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink transition"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <span className="h-4 w-px bg-line" />

            <a
              href="/admin"
              className="text-xs text-muted hover:text-ink transition flex items-center gap-1 font-medium"
            >
              Legacy /admin <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </header>

        {/* Page Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>

        {/* Live Real-time Operations Event Ticker */}
        <LiveActivityTicker />
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectSection={onSelectSection}
        onRefreshData={() => refreshMutation.mutate()}
      />

      {/* Shortcuts Modal */}
      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
