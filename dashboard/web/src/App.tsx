import React, { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { LiveFleetPage } from "./pages/LiveFleetPage";
import { JobsPage } from "./pages/JobsPage";
import { FinishedJobsPage } from "./pages/FinishedJobsPage";
import { DriversPage } from "./pages/DriversPage";
import { FinancePage } from "./pages/FinancePage";
import { ExceptionsPage } from "./pages/ExceptionsPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { ActivityPage } from "./pages/ActivityPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  // Check auth status on start
  useEffect(() => {
    fetch("/ops/api/auth/status")
      .then(res => res.json())
      .then(data => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  // Read URL query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get("section");
    if (sec) {
      setActiveSection(sec);
    }
  }, []);

  const handleSelectSection = (section: string) => {
    setActiveSection(section);
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    window.history.pushState({}, "", url.toString());
  };

  const handleOpenJob = (_jobId: string) => {
    setActiveSection("jobs");
    const url = new URL(window.location.href);
    url.searchParams.set("section", "jobs");
    window.history.pushState({}, "", url.toString());
  };

  const handleLogout = async () => {
    await fetch("/ops/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  };

  // Loading spinner while verifying session
  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-navy-800 border border-tmv-cyan/40 flex items-center justify-center mx-auto mb-3 animate-pulse font-mono font-bold text-tmv-cyan">
            TMV
          </div>
          <span className="text-xs text-muted font-mono tracking-wider uppercase">Initializing Operations HUD...</span>
        </div>
      </div>
    );
  }

  // If not logged in, render the state-of-the-art Login experience
  if (!authenticated) {
    return <LoginPage onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <Layout activeSection={activeSection} onSelectSection={handleSelectSection} onLogout={handleLogout}>
      {activeSection === "overview" && <OverviewPage onSelectSection={handleSelectSection} />}
      {activeSection === "live_fleet" && <LiveFleetPage onSelectSection={handleSelectSection} />}
      {activeSection === "jobs" && <JobsPage />}
      {activeSection === "finished" && <FinishedJobsPage />}
      {activeSection === "checkin" && <ScenariosPage kind="checkin" />}
      {activeSection === "checkout" && <ScenariosPage kind="checkout" />}
      {activeSection === "parking" && <ScenariosPage kind="parking" />}
      {activeSection === "liability" && <ScenariosPage kind="liability" />}
      {activeSection === "drivers" && <DriversPage />}
      {activeSection === "finance" && <FinancePage />}
      {activeSection === "exceptions" && <ExceptionsPage onOpenJob={handleOpenJob} />}
      {activeSection === "activity" && <ActivityPage />}
      {activeSection === "reports" && <ReportsPage />}
      {activeSection === "settings" && <SettingsPage />}
    </Layout>
  );
}
