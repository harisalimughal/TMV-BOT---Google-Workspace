import React, { useState } from "react";
import { MessageSquare, Save, RotateCcw, AlertTriangle, User, Hash, Clock, MapPin } from "lucide-react";

interface Template {
  id: string;
  title: string;
  description: string;
  content: string;
  defaultContent: string;
  channels: string[];
}

const SEED_TEMPLATES = {
  customer: [
    {
      id: "client_reminder",
      title: "Client Reminder / \"On My Way\"",
      description: "Sent to customer automatically before job start (SMS & Email).",
      channels: ["SMS", "Email"],
      defaultContent: "Hi, I'm {{driver_name}}, your driver from The Man Van. My vehicle registration is {{vehicle_registration}}. I'm on my way to your pickup location. If you have any questions, please call me on {{driver_phone}}.",
      content: "Hi, I'm {{driver_name}}, your driver from The Man Van. My vehicle registration is {{vehicle_registration}}. I'm on my way to your pickup location. If you have any questions, please call me on {{driver_phone}}."
    },
    {
      id: "review_request",
      title: "Review Request Email",
      description: "Sent to customer automatically upon successful job completion (Email only).",
      channels: ["Email"],
      defaultContent: "Hi {{client_name}},\nYour driver mentioned how smoothly everything went and asked us to say a big THANK YOU for being so kind and easy to work with! 😊\nIf you have a moment, we'd really appreciate it if you could leave us a quick 5-star ⭐⭐⭐⭐⭐ review. Your review will be featured on The Man Van website and helps our drivers build their reputation and get more work — so it genuinely means a lot to us.\nThanks again for choosing The Man Van and for making the move such a pleasure! 🤗\nReview us here 👉 {{review_link}}",
      content: "Hi {{client_name}},\nYour driver mentioned how smoothly everything went and asked us to say a big THANK YOU for being so kind and easy to work with! 😊\nIf you have a moment, we'd really appreciate it if you could leave us a quick 5-star ⭐⭐⭐⭐⭐ review. Your review will be featured on The Man Van website and helps our drivers build their reputation and get more work — so it genuinely means a lot to us.\nThanks again for choosing The Man Van and for making the move such a pleasure! 🤗\nReview us here 👉 {{review_link}}"
    },
    {
      id: "job_started",
      title: "Customer Message — Job Started",
      description: "Sent to customer when driver arrives (SMS only).",
      channels: ["SMS"],
      defaultContent: "Hi {{client_name}}, your TMV driver {{driver_name}} has officially arrived and started the job clock at {{job_time}}.",
      content: "Hi {{client_name}}, your TMV driver {{driver_name}} has officially arrived and started the job clock at {{job_time}}."
    }
  ],
  driver: [],
  payment: [],
  evidence: [],
  legal: [],
  other: []
};

const AVAILABLE_VARIABLES = [
  "{{driver_name}}",
  "{{vehicle_registration}}",
  "{{driver_phone}}",
  "{{client_name}}",
  "{{job_time}}",
  "{{pickup_address}}",
  "{{review_link}}"
];

const MOCK_DATA: Record<string, string> = {
  "{{driver_name}}": "Rafael Cruz",
  "{{vehicle_registration}}": "LV24 MVO",
  "{{driver_phone}}": "07455 123456",
  "{{client_name}}": "Sarah Jenkins",
  "{{job_time}}": "09:30 AM",
  "{{pickup_address}}": "142 Battersea Park Road, London",
  "{{review_link}}": "https://g.page/r/tmv-review/leave"
};

const TABS = [
  { id: "customer", label: "Customer Communications" },
  { id: "driver", label: "Driver Notifications" },
  { id: "payment", label: "Payment Messages" },
  { id: "evidence", label: "Photo/Evidence Requests" },
  { id: "legal", label: "Legal & Confirmation Text" },
  { id: "other", label: "Other Automated Messages" }
];

export function MessagingPage() {
  const [activeTab, setActiveTab] = useState("customer");
  const [templates, setTemplates] = useState<Record<string, Template[]>>(SEED_TEMPLATES);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

  // Notification Timing Config
  const [timingVal, setTimingVal] = useState("60");
  const [timingUnit, setTimingUnit] = useState("minutes");
  const [sendOnBehalf, setSendOnBehalf] = useState(true);

  const handleUpdateTemplate = (tabId: string, templateId: string, newContent: string) => {
    const updatedTabs = { ...templates };
    const tabTemplates = [...updatedTabs[tabId]];
    const index = tabTemplates.findIndex(t => t.id === templateId);
    if (index > -1) {
      tabTemplates[index].content = newContent;
      updatedTabs[tabId] = tabTemplates;
      setTemplates(updatedTabs);
      
      // Mark unsaved
      if (newContent !== tabTemplates[index].defaultContent) {
        setUnsavedChanges(prev => new Set(prev).add(templateId));
      } else {
        const next = new Set(unsavedChanges);
        next.delete(templateId);
        setUnsavedChanges(next);
      }
    }
  };

  const handleReset = (tabId: string, templateId: string) => {
    const updatedTabs = { ...templates };
    const tabTemplates = [...updatedTabs[tabId]];
    const index = tabTemplates.findIndex(t => t.id === templateId);
    if (index > -1) {
      tabTemplates[index].content = tabTemplates[index].defaultContent;
      updatedTabs[tabId] = tabTemplates;
      setTemplates(updatedTabs);
      
      const next = new Set(unsavedChanges);
      next.delete(templateId);
      setUnsavedChanges(next);
    }
  };

  const insertVariable = (tabId: string, templateId: string, variable: string) => {
    const tabTemplates = templates[tabId];
    const template = tabTemplates.find(t => t.id === templateId);
    if (template) {
      handleUpdateTemplate(tabId, templateId, template.content + variable);
    }
  };

  const renderPreview = (content: string) => {
    let preview = content;
    Object.entries(MOCK_DATA).forEach(([variable, value]) => {
      // Replace all instances
      preview = preview.split(variable).join(value);
    });
    return preview;
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-[20px] border border-line shadow-sm">
        <h2 className="text-[20px] font-bold text-ink mb-1">Content / Messaging Management</h2>
        <p className="text-[14px] text-muted max-w-3xl">
          Manage all automated messages sent to customers and drivers. Changes apply immediately, no code changes required.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Nav (Tabs) */}
        <div className="w-full lg:w-64 shrink-0 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-[12px] text-[13px] font-medium transition ${
                activeTab === tab.id 
                  ? "bg-white text-brand shadow-sm border border-line font-semibold" 
                  : "text-muted hover:bg-white/50 hover:text-ink border border-transparent"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && <ChevronRight className="w-4 h-4 text-brand" />}
            </button>
          ))}
        </div>

        {/* Right Content */}
        <div className="flex-1 space-y-6">
          
          {/* Timing Config (Only in customer tab for demonstration) */}
          {activeTab === "customer" && (
            <div className="bg-white rounded-[20px] border border-line shadow-sm p-6">
              <h3 className="text-[15px] font-bold text-ink mb-4">Notification Timing Configuration</h3>
              
              <div className="flex flex-col md:flex-row md:items-start gap-8">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-ink mb-1.5">Send client notification</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        value={timingVal}
                        onChange={e => setTimingVal(e.target.value)}
                        className="w-20 h-10 px-3 rounded-[8px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                      />
                      <select 
                        value={timingUnit}
                        onChange={e => setTimingUnit(e.target.value)}
                        className="h-10 px-3 rounded-[8px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                      >
                        <option value="minutes">Minutes before job start</option>
                        <option value="hours">Hours before job start</option>
                      </select>
                    </div>
                  </div>
                  
                  <p className="text-[13px] text-muted leading-relaxed bg-[#F9FAFB] p-3 rounded-lg border border-line">
                    This message will be sent automatically at the configured time before each job, calculated from the job's scheduled start time. Example: for a 9:00 AM job with a 60-minute setting, the message sends at 8:00 AM.
                  </p>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-ink mb-2">Sender Identity</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                        <input type="radio" checked={sendOnBehalf} onChange={() => setSendOnBehalf(true)} className="text-brand focus:ring-brand w-4 h-4" />
                        Send on behalf of assigned driver
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                        <input type="radio" checked={!sendOnBehalf} onChange={() => setSendOnBehalf(false)} className="text-brand focus:ring-brand w-4 h-4" />
                        Send from company account
                      </label>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button className="h-10 px-5 rounded-[8px] bg-brand hover:bg-brand-dark text-white text-[13px] font-semibold shadow-sm transition">
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Templates */}
          {templates[activeTab]?.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-line shadow-sm p-12 text-center">
              <MessageSquare className="w-8 h-8 text-muted mx-auto mb-3" />
              <h3 className="text-[15px] font-bold text-ink">No templates configured</h3>
              <p className="text-[13px] text-muted">There are no templates in this section yet.</p>
            </div>
          ) : (
            templates[activeTab]?.map((template) => {
              const isUnsaved = unsavedChanges.has(template.id);
              const isSms = template.channels.includes("SMS");
              const chars = template.content.length;
              const isSmsOverlimit = isSms && chars > 160;

              return (
                <div key={template.id} className="bg-white rounded-[20px] border border-line shadow-sm overflow-hidden flex flex-col">
                  {/* Card Header */}
                  <div className="p-5 border-b border-line bg-white flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                        {template.title}
                        {isUnsaved && <span className="w-2 h-2 rounded-full bg-status-red" title="Unsaved changes"></span>}
                      </h3>
                      <p className="text-[13px] text-muted mt-1">{template.description}</p>
                    </div>
                    <div className="flex gap-2">
                      {template.channels.map(ch => (
                        <span key={ch} className="px-2.5 py-1 rounded-md bg-surface border border-line text-[11px] font-bold text-muted uppercase tracking-wider">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Body (Editor + Preview) */}
                  <div className="p-5 flex flex-col xl:flex-row gap-6 bg-[#FAFAFA]">
                    
                    {/* Editor Side */}
                    <div className="flex-1 flex flex-col">
                      <div className="mb-3">
                        <span className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-2">Available Variables</span>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_VARIABLES.map(v => (
                            <button
                              key={v}
                              onClick={() => insertVariable(activeTab, template.id, v)}
                              className="px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-brand text-[12px] font-medium border border-blue-200 transition"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        value={template.content}
                        onChange={(e) => handleUpdateTemplate(activeTab, template.id, e.target.value)}
                        className="w-full h-40 md:h-52 p-4 rounded-xl border border-line bg-white text-[14px] font-mono text-ink shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none transition"
                        placeholder="Type message template here..."
                      />
                      
                      {/* Character Count */}
                      {isSms && (
                        <div className={`mt-2 flex items-center gap-1.5 text-[12px] font-semibold ${isSmsOverlimit ? 'text-status-red' : 'text-muted'}`}>
                          {isSmsOverlimit && <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{chars} characters (SMS standard is 160)</span>
                        </div>
                      )}
                    </div>

                    {/* Preview Side */}
                    <div className="flex-1 flex flex-col">
                      <span className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-2">Live Preview</span>
                      
                      <div className="flex-1 bg-white border border-line rounded-xl p-5 shadow-sm relative overflow-hidden">
                        {/* Decorative Chat bubble style */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-[#10b981]"></div>
                        
                        <div className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">
                          {renderPreview(template.content) || <span className="text-muted italic">Empty message...</span>}
                        </div>

                        {/* Metadata Mock */}
                        <div className="mt-6 pt-4 border-t border-line border-dashed flex items-center justify-between text-[11px] font-semibold text-muted uppercase tracking-wider">
                          <span>Simulated resolution</span>
                          <span>Job ID: 4192A</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-5 border-t border-line bg-white flex justify-end gap-3">
                    <button 
                      onClick={() => handleReset(activeTab, template.id)}
                      disabled={!isUnsaved}
                      className="px-4 py-2 rounded-[8px] text-[13px] font-semibold text-muted hover:bg-surface hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> Reset to default
                    </button>
                    <button 
                      disabled={!isUnsaved}
                      className="px-5 py-2 rounded-[8px] bg-[#2563EB] disabled:bg-[#93C5FD] hover:bg-blue-700 text-white text-[13px] font-semibold shadow-sm transition flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> {isUnsaved ? "Save Changes" : "Saved"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Utility icon component since I can't import ChevronRight statically here if missing
function ChevronRight(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
