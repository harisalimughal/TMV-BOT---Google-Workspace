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
  Sliders,
  Bell
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchExceptions, triggerDatasetRefresh } from "../api/client";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsModal } from "./ShortcutsModal";
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
  { id: "jobs", label: "Jobs", icon: Truck, desc: "Operational moves joined across Bookings, Drivers, Workflow and Evidence" },
  { id: "finished", label: "Finished Jobs", icon: CheckSquare, desc: "Completed moves audit with verified evidence and sign-off records" },
  { type: "header", label: "Scenarios" },
  { id: "checkin", label: "Check In", icon: LogIn, desc: "Storage facility entry logs and client container check-ins" },
  { id: "checkout", label: "Check Out", icon: LogOut, desc: "Storage retrieval and client drop-off confirmation records" },
  { id: "parking", label: "Parking Liability", icon: AlertCircle, desc: "Driver parking risk waivers and client location sign-offs" },
  { id: "liability", label: "Liability Report", icon: ShieldAlert, desc: "Vehicle or item damage categories with evidence photographs" },
  { type: "header", label: "Management" },
  { id: "drivers", label: "Drivers", icon: Users, desc: "Driver scorecards, revenue handled and punctuality metrics" },
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
      } else if (e.key === "j" || e.key === "J") {
        onSelectSection("jobs");
      } else if (e.key === "d" || e.key === "D") {
        onSelectSection("drivers");
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
        className={`bg-paper text-ink flex flex-col justify-between border-r border-line transition-all duration-300 z-30 sticky top-0 h-screen ${
          collapsed ? "w-16" : "w-[260px]"
        }`}
      >
        <div className="flex flex-col min-h-0">
          {/* Brand Header */}
          <div className="pt-6 pb-4 px-6 flex items-center justify-between bg-transparent">
            {!collapsed && (
              <div className="flex items-center overflow-hidden">
                <img
                  src="/tmv-new-logo.png"
                  alt="The Man Van"
                  className="h-14 w-auto object-contain flex-shrink-0"
                />
              </div>
            )}
            {collapsed && (
              <img
                src="/tmv-new-logo.png"
                alt="TMV"
                className="w-8 h-8 rounded-lg object-contain bg-surface border border-line p-0.5 mx-auto shadow-2xs"
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
          <nav className="px-4 pb-4 space-y-1 overflow-y-auto flex-1">
            {NAV_CONFIG.map((item, idx) => {
              if (item.type === "header") {
                if (collapsed) return <div key={idx} className="my-4 border-t border-line" />;
                return (
                  <div
                    key={idx}
                    className="pt-5 pb-2 px-3 text-meta text-muted uppercase"
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
                  className={`w-full h-10 flex items-center gap-3 px-3 rounded-lg text-nav transition group ${
                    isActive
                      ? "text-brand font-semibold bg-brand-soft"
                      : "text-muted hover:bg-surface-hover hover:text-ink"
                  }`}
                  title={collapsed ? item.label : undefined}
                >

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
                  WC
                </div>
                <div className="overflow-hidden">
                  <span className="font-medium text-ink truncate block text-xs">Washington Carrato</span>
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
        {/* 2. TOP GLOBAL HEADER */}
        <header className="h-[56px] bg-paper border-b border-line px-6 flex items-center justify-between sticky top-0 z-20">
          {/* Left: Global Search */}
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block w-[320px]">
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search anything"
                onClick={() => setPaletteOpen(true)}
                readOnly
                className="w-full h-9 pl-9 pr-3 bg-surface border border-line rounded-lg text-sm text-ink placeholder:text-muted focus:bg-paper focus:border-brand cursor-pointer transition"
              />
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-4">

            <div className="flex items-center gap-2">
              <button
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="w-9 h-9 rounded-full hover:bg-surface flex items-center justify-center text-muted hover:text-ink transition"
                title="Sync live sheets data (R)"
              >
                <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? "animate-spin text-brand" : "text-muted"}`} />
              </button>

              <button
                onClick={() => setShortcutsOpen(true)}
                className="w-9 h-9 rounded-full hover:bg-surface flex items-center justify-center text-muted hover:text-ink transition"
                title="Keyboard shortcuts (?)"
              >
                <Command className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectSection("exceptions")}
                className="relative w-9 h-9 rounded-full hover:bg-surface flex items-center justify-center text-muted hover:text-ink transition"
              >
                <Bell className="w-4 h-4" />
                {rawBadgeCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-status-red rounded-full ring-2 ring-paper" />
                )}
              </button>

              <div className="w-9 h-9 ml-2 rounded-full bg-brand-soft text-brand font-bold text-xs flex items-center justify-center border-2 border-paper shadow-2xs">
                  WC
                </div>
            </div>
          </div>
        </header>

        {/* Page Main Content Area */}
        {/* 3. PAGE HEADER & CONTENT */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Section Header */}
          <div className="bg-paper border-b border-line px-8 py-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="text-brand">
                <currentNav.icon className="w-6 h-6" />
              </div>
              <h1 className="text-page-title text-ink tracking-tight">
                {currentNav.label}
              </h1>
            </div>
            
            {/* Contextual actions could go here (e.g. Settings, Permissions) */}
            <div className="flex items-center gap-3"></div>
          </div>
          
          {/* Page Content */}
          <main className="flex-1 p-8">{children}</main>
        </div>
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
