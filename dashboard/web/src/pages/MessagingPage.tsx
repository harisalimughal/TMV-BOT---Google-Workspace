import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Save, RotateCcw, AlertTriangle } from "lucide-react";
import { EditableSetting, fetchSettings, saveSetting } from "../api/client";

// The real, single-shared placeholder syntax renderMessageTemplate() (src/notifications/message.ts)
// actually substitutes -- not every setting supports every token, see VARIABLES_BY_KEY.
const MOCK_DATA: Record<string, string> = {
  "{customerName}": "Sarah Jenkins",
  "{companyName}": "The Man Van",
  "{pickup}": "142 Battersea Park Road, London",
  "{dropoff}": "45 Depot Road, London",
  "{driverPhone}": "07455 123456",
  "{vanRegistration}": "LV24 MVO",
  "{driver_name}": "James Dean",
  "{job_time}": "9:00 AM",
  "{job_date}": "Monday 25 Aug",
  "{booking_date}": "Monday 25 Aug"
};

const VARIABLES_BY_KEY: Record<string, string[]> = {
  confirmationText: [],
  jobStartedMessage: ["{customerName}", "{companyName}", "{pickup}", "{dropoff}", "{driverPhone}", "{vanRegistration}", "{driver_name}", "{job_time}", "{job_date}"],
  reviewRequestEmail: ["{customerName}", "{companyName}", "{pickup}", "{dropoff}", "{job_date}"],
  jobCompletionEmail: ["{customerName}", "{companyName}", "{pickup}", "{dropoff}", "{driver_name}", "{job_time}", "{job_date}"],
  clientNotificationOffsetMinutes: []
};

const CHANNELS_BY_KEY: Record<string, string[]> = {
  confirmationText: ["Signature pad"],
  jobStartedMessage: ["SMS", "Email"],
  reviewRequestEmail: ["Email"],
  jobCompletionEmail: ["Email"],
  clientNotificationOffsetMinutes: ["Auto-scheduler"]
};

function renderPreview(content: string): string {
  let preview = content;
  for (const [token, value] of Object.entries(MOCK_DATA)) {
    preview = preview.split(token).join(value);
  }
  return preview;
}

// The 3 real admin-editable message templates the classic /admin panel's Settings tab
// exposes (src/admin/admin.routes.ts's EDITABLE_SETTINGS) -- rendered and saved
// through the same GET/POST /admin/api/settings the driver-facing cards actually read
// from (via getSetting()), not a disconnected mock with its own invented placeholder
// syntax and template categories the bot has no capability to send.
export function MessagingPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const settings = data?.settings ?? [];

  useEffect(() => {
    if (!data) return;
    setDrafts(prev => {
      const next = { ...prev };
      for (const s of data.settings) {
        if (!(s.key in next)) next[s.key] = s.value;
      }
      return next;
    });
  }, [data]);

  const draftFor = (s: EditableSetting) => drafts[s.key] ?? s.value;
  const isUnsaved = (s: EditableSetting) => draftFor(s) !== s.value;

  const handleSave = async (s: EditableSetting) => {
    setSavingKey(s.key);
    setSaveErrors(prev => ({ ...prev, [s.key]: "" }));
    try {
      await saveSetting(s.key, draftFor(s));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch (err: any) {
      setSaveErrors(prev => ({ ...prev, [s.key]: err?.message || "Failed to save." }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-[20px] border border-line shadow-sm">
        <h2 className="text-[20px] font-bold text-ink mb-1">Content / Messaging Management</h2>
        <p className="text-[14px] text-muted max-w-3xl">
          Edit the customer-facing text the classic Start Job workflow actually sends. Changes save straight
          to the Settings sheet and take effect on the driver's very next card/message -- no deploy required.
        </p>
      </div>

      {isLoading && (
        <div className="h-64 bg-white rounded-[24px] border border-line animate-pulse flex items-center justify-center">
          <span className="text-muted font-medium">Loading templates...</span>
        </div>
      )}

      {error && (
        <div className="p-8 text-center text-status-red bg-status-red-bg rounded-[24px] border border-status-red/20 shadow-sm">
          Failed to load message templates.
        </div>
      )}

      {!isLoading && !error && settings.length === 0 && (
        <div className="bg-white rounded-[20px] border border-line shadow-sm p-12 text-center">
          <MessageSquare className="w-8 h-8 text-muted mx-auto mb-3" />
          <h3 className="text-[15px] font-bold text-ink">No templates configured</h3>
        </div>
      )}

      {!isLoading && !error && settings.map(s => {
        const draft = draftFor(s);
        const unsaved = isUnsaved(s);
        const isSms = (CHANNELS_BY_KEY[s.key] || []).includes("SMS");
        const chars = draft.length;
        const isSmsOverlimit = isSms && chars > 160;
        const variables = VARIABLES_BY_KEY[s.key] || [];
        const channels = CHANNELS_BY_KEY[s.key] || [];
        const saveError = saveErrors[s.key];

        return (
          <div key={s.key} className="bg-white rounded-[20px] border border-line shadow-sm overflow-hidden flex flex-col">
            {/* Card Header */}
            <div className="p-5 border-b border-line bg-white flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                  {s.label}
                  {unsaved && <span className="w-2 h-2 rounded-full bg-status-red" title="Unsaved changes"></span>}
                </h3>
                <p className="text-[13px] text-muted mt-1 max-w-2xl">{s.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {channels.map(ch => (
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
                {variables.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-2">Available Variables</span>
                    <div className="flex flex-wrap gap-2">
                      {variables.map(v => (
                        <button
                          key={v}
                          onClick={() => setDrafts(prev => ({ ...prev, [s.key]: draftFor(s) + v }))}
                          className="px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-brand text-[12px] font-medium border border-blue-200 transition"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  value={draft}
                  onChange={e => setDrafts(prev => ({ ...prev, [s.key]: e.target.value }))}
                  className="w-full h-40 md:h-52 p-4 rounded-xl border border-line bg-white text-[14px] font-mono text-ink shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none transition"
                  placeholder="Type message template here..."
                />

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
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-[#10b981]"></div>
                  <div className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">
                    {renderPreview(draft) || <span className="text-muted italic">Empty message...</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-5 border-t border-line bg-white">
              {saveError && (
                <p className="text-[12px] text-status-red font-medium mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {saveError}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDrafts(prev => ({ ...prev, [s.key]: s.fallback }))}
                  disabled={draft === s.fallback}
                  className="px-4 py-2 rounded-[8px] text-[13px] font-semibold text-muted hover:bg-surface hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Reset to default
                </button>
                <button
                  onClick={() => handleSave(s)}
                  disabled={!unsaved || savingKey === s.key || !draft.trim()}
                  className="px-5 py-2 rounded-[8px] bg-[#2563EB] disabled:bg-[#93C5FD] hover:bg-blue-700 text-white text-[13px] font-semibold shadow-sm transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {savingKey === s.key ? "Saving…" : unsaved ? "Save Changes" : "Saved"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
