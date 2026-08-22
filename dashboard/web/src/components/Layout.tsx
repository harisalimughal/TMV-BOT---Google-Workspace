import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
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
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchExceptions, triggerDatasetRefresh } from "../api/client";

interface Props {
  activeSection: string;
  onSelectSection: (id: string) => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "jobs", label: "All Jobs", icon: Truck },
  { id: "finished", label: "Finished Jobs", icon: CheckSquare },
  { type: "header", label: "Scenarios" },
  { id: "checkin", label: "Storage Check In", icon: LogIn },
  { id: "checkout", label: "Storage Check Out", icon: LogOut },
  { id: "parking", label: "Parking Liability", icon: AlertCircle },
  { id: "liability", label: "Liability Report", icon: ShieldAlert },
  { type: "header", label: "Management" },
  { id: "drivers", label: "Drivers", icon: Users },
  { id: "finance", label: "Finance & Reconciliation", icon: Banknote },
  { id: "exceptions", label: "Exceptions", icon: AlertTriangle, hasBadge: true },
  { id: "activity", label: "Activity Log", icon: History },
  { id: "reports", label: "Reports & Exports", icon: FileSpreadsheet },
  { id: "settings", label: "Settings", icon: Settings }
];

export function Layout({ activeSection, onSelectSection, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [londonTime, setLondonTime] = useState("");
  const queryClient = useQueryClient();

  // Polling for unresolved exceptions count
  const { data: exData } = useQuery({
    queryKey: ["exceptions_badge"],
    queryFn: () => fetchExceptions(),
    refetchInterval: 30000
  });

  // Force dataset refresh
  const refreshMutation = useMutation({
    mutationFn: triggerDatasetRefresh,
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLondonTime(
        now.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const exceptionsCount = exData?.total || 0;

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Dark Navy Sidebar */}
      <aside
        className={`bg-navy-900 text-white flex flex-col justify-between border-r border-navy-700 transition-all duration-300 z-30 sticky top-0 h-screen ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-navy-800">
            {!collapsed && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-navy-800 border border-navy-600 flex items-center justify-center font-mono font-bold text-tmv-cyan text-sm shadow">
                  TMV
                </div>
                <div>
                  <span className="font-bold text-sm tracking-tight text-white block">OPERATIONS</span>
                  <span className="text-[10px] text-muted tracking-widest uppercase">Admin v3.0</span>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="w-8 h-8 rounded-lg bg-navy-800 border border-navy-600 flex items-center justify-center font-mono font-bold text-tmv-cyan text-sm mx-auto shadow">
                T
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-navy-800 transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {NAV_ITEMS.map((item, idx) => {
              if (item.type === "header") {
                if (collapsed) return <div key={idx} className="my-2 border-t border-navy-800" />;
                return (
                  <div key={idx} className="pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
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
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-tmv-blue text-white shadow-sm"
                      : "text-gray-300 hover:text-white hover:bg-navy-800"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-tmv-cyan"}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.hasBadge && exceptionsCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.2 rounded-full bg-status-red text-white text-[10px] font-bold font-mono animate-pulse">
                      {exceptionsCount}
                    </span>
                  )}
                  {collapsed && item.hasBadge && exceptionsCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-status-red absolute right-2" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info in Sidebar */}
        <div className="p-3 border-t border-navy-800 bg-navy-950/40">
          {!collapsed ? (
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-tmv-cyan" /> London Time
              </span>
              <span className="font-mono font-bold text-white">{londonTime}</span>
            </div>
          ) : (
            <div className="text-center font-mono text-[10px] text-tmv-cyan">{londonTime}</div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-paper border-b border-line px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-ink tracking-tight capitalize">
              {NAV_ITEMS.find(n => n.id === activeSection)?.label || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Refresh Button */}
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-surface-2 text-xs font-semibold text-ink-2 transition"
              title="Sync latest live Google Sheets data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-tmv-blue ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              <span>{refreshMutation.isPending ? "Syncing..." : "Sync Live Data"}</span>
            </button>

            {/* Legacy Admin Link */}
            <a
              href="/admin"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink font-medium transition"
            >
              Legacy /admin <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
