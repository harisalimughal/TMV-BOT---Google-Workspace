import React, { useEffect } from "react";
import { Keyboard, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "⌘K / Ctrl+K / /", desc: "Open Command Palette / Search" },
  { key: "?", desc: "Show / Hide Keyboard Shortcuts Modal" },
  { key: "R", desc: "Sync Live Sheets Data" },
  { key: "O", desc: "Go to Overview" },
  { key: "J", desc: "Go to Jobs" },
  { key: "D", desc: "Go to Drivers" },
  { key: "F", desc: "Go to Finance" },
  { key: "E", desc: "Go to Exceptions" },
  { key: "Esc", desc: "Close modal or lightbox" }
];

export function ShortcutsModal({ isOpen, onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-paper border border-line rounded shadow-pop overflow-hidden text-ink">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-surface/50">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-semibold text-ink">Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-ink hover:bg-surface transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-1.5">
          {SHORTCUTS.map((sc, i) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-line/60 text-xs">
              <span className="text-ink-2">{sc.desc}</span>
              <kbd className="px-2 py-0.5 bg-surface border border-line rounded font-mono text-ink text-[11px]">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-2.5 bg-surface/30 border-t border-line text-[11px] text-muted text-right">
          Press <kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-line">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
