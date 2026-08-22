import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut, AlertCircle, ShieldAlert, FileText, ExternalLink } from "lucide-react";
import { fetchScenarios } from "../api/client";
import { ScenarioItem } from "../types";
import { PhotoModal } from "../components/PhotoModal";

interface Props {
  kind: "checkin" | "checkout" | "parking" | "liability";
}

const KIND_TITLES: Record<string, { title: string; desc: string; icon: any }> = {
  checkin: { title: "Storage Check In Records", desc: "Storage facility entry logs and client container check-ins", icon: LogIn },
  checkout: { title: "Storage Check Out Records", desc: "Storage retrieval and client drop-off confirmation", icon: LogOut },
  parking: { title: "Parking Liability Records", desc: "Driver parking risk waivers and client location sign-offs", icon: AlertCircle },
  liability: { title: "Damage & Liability Reports", desc: "Vehicle or item damage categories with evidence photos", icon: ShieldAlert }
};

export function ScenariosPage({ kind }: Props) {
  const [page, setPage] = useState(1);
  const [activePhoto, setActivePhoto] = useState<{ title: string; url: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["scenario", kind, page],
    queryFn: () => fetchScenarios(kind, page)
  });

  const config = KIND_TITLES[kind] || KIND_TITLES.checkin;
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-navy-900 text-tmv-cyan flex items-center justify-center shadow">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink">{config.title}</h2>
          <p className="text-xs text-muted">{config.desc}</p>
        </div>
      </div>

      {isLoading && (
        <div className="py-16 text-center text-muted animate-pulse">Loading scenario records...</div>
      )}

      {error && (
        <div className="p-8 text-center text-status-red bg-paper rounded-xl border border-line">
          Failed to load scenario records.
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div className="p-12 text-center text-muted bg-paper rounded-xl border border-line">
          No records logged in this scenario tab yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {!isLoading &&
          data?.items.map((item: ScenarioItem) => (
            <div key={item.id} className="p-6 bg-paper rounded-xl border border-line shadow-paper flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
                  <div>
                    <span className="font-mono font-bold text-sm text-tmv-blue block">{item["Job ID"] || "No Job ID"}</span>
                    <span className="text-xs text-muted font-mono">{item.Timestamp || item.Date}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-surface-2 text-ink-2 font-mono text-xs font-bold">
                    {item.Driver || "Unknown Driver"}
                  </span>
                </div>

                <div className="space-y-2 text-xs mb-4">
                  {item["Client Name"] && (
                    <div>
                      <span className="text-muted block">Client Name</span>
                      <span className="font-bold text-ink">{item["Client Name"]}</span>
                    </div>
                  )}
                  {item["Client Full Name"] && (
                    <div>
                      <span className="text-muted block">Client Full Name</span>
                      <span className="font-bold text-ink">{item["Client Full Name"]}</span>
                    </div>
                  )}
                  {item["Container Number"] && (
                    <div>
                      <span className="text-muted block">Container Number</span>
                      <span className="font-mono font-bold text-ink">{item["Container Number"]}</span>
                    </div>
                  )}
                  {item.Address && (
                    <div>
                      <span className="text-muted block">Address</span>
                      <span className="font-semibold text-ink">{item.Address}</span>
                    </div>
                  )}
                  {item["Damage Categories"] && (
                    <div>
                      <span className="text-muted block">Damage Categories</span>
                      <span className="font-semibold text-status-red">{item["Damage Categories"]}</span>
                    </div>
                  )}
                </div>

                {/* Evidence Thumbs */}
                {item.photos.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-line">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-2">
                      Photographs ({item.photos.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {item.photos.map((p, idx) => (
                        <div
                          key={p.fileId}
                          onClick={() => setActivePhoto({ title: `${item["Job ID"]} - Photo #${idx + 1}`, url: p.thumbUrl })}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-line bg-surface cursor-pointer hover:border-tmv-blue transition group relative"
                        >
                          <img
                            src={p.thumbUrl}
                            alt="Photo"
                            className="w-full h-full object-cover group-hover:scale-110 transition"
                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signature Preview */}
                {item.signature && (
                  <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Customer Signature</span>
                    <button
                      onClick={() => setActivePhoto({ title: `${item["Job ID"]} - Signature`, url: item.signature!.thumbUrl })}
                      className="text-xs text-tmv-blue font-semibold hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Signature
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {activePhoto && (
        <PhotoModal
          isOpen={true}
          onClose={() => setActivePhoto(null)}
          title={activePhoto.title}
          photoUrl={activePhoto.url}
        />
      )}
    </div>
  );
}
