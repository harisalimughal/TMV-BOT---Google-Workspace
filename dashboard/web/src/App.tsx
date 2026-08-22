import React, { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { OverviewPage } from "./pages/OverviewPage";
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

  // Read URL query parameters on initial mount
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

  return (
    <Layout activeSection={activeSection} onSelectSection={handleSelectSection}>
      {activeSection === "overview" && <OverviewPage onSelectSection={handleSelectSection} />}
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
