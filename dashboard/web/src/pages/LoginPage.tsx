import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface Props {
  onLogin: () => void;
}

// Single shared admin password, same as the classic /admin panel -- there is no
// per-user email/2FA concept anywhere in the backend (see dashboard/server/auth.ts's
// checkAdminPassword), so this form only ever asks for the one thing the server
// actually checks.
export function LoginPage({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/ops/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message || 'Incorrect password.');
        return;
      }
      onLogin();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-4 sm:p-8 font-sans">

      {/* LOGO */}
      <div className="mb-8 flex items-center justify-center">
        <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
          <span className="text-white font-bold text-2xl tracking-tighter" style={{ fontFamily: 'monospace' }}>MV</span>
        </div>
      </div>

      {/* CARD */}
      <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-line p-8 sm:p-10">
        <div className="animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center mb-8">
            <h1 className="text-[20px] font-bold text-ink mb-2">Sign in to Operations</h1>
            <p className="text-[14px] text-muted">Enter the admin password to access the dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center gap-3 text-[#B91C1C]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-[13px] font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-ink">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full h-11 pl-10 pr-12 rounded-full bg-surface border border-line text-[14px] text-ink focus:border-brand focus:bg-white outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[46px] mt-2 rounded-full bg-[#1A1A1A] hover:bg-black text-white text-[14px] font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Signing in...
                </>
              ) : "Sign In"}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-[12px] text-muted font-medium">© {new Date().getFullYear()} The Man Van Operations</p>
      </div>

    </div>
  );
}
