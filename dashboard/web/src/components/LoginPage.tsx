import React, { useState } from "react";
import { Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface Props {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/ops/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error?.message || "Invalid password");
      }
    } catch {
      setError("Network error connecting to operations backend");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setPassword("admin");
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/ops/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "admin" })
      });
      if (res.ok) onSuccess();
      else setError("Default password failed. Enter configured password.");
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4 selection:bg-brand-soft selection:text-brand">
      <div className="w-full max-w-sm bg-paper border border-line rounded p-8 shadow-card">
        {/* Header with Official Logo */}
        <div className="text-center mb-6">
          <img
            src="/tmv-new-logo.png"
            alt="The Man Van - Helping you move forward"
            className="h-24 mx-auto mb-4 object-contain"
          />
          <h1 className="text-base font-bold text-ink">Operations Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">Enter password to access live London dispatch & audit</p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-4 p-2.5 bg-status-red-bg border border-status-red/20 rounded flex items-center gap-2 text-xs text-status-red">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-2 block mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoFocus
                className="w-full pl-9 pr-3 h-9 bg-surface rounded text-xs border border-line-strong focus:bg-paper focus:border-brand focus:outline-none transition text-ink font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-9 rounded bg-brand text-white text-xs font-medium hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Access */}
        <div className="mt-5 pt-4 border-t border-line text-center">
          <button
            onClick={handleQuickDemoLogin}
            disabled={loading}
            className="text-xs text-brand hover:underline font-medium transition"
          >
            Quick unlock with default password
          </button>
        </div>
      </div>
    </div>
  );
}
