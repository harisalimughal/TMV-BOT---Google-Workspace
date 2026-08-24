import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield, AlertTriangle, Smartphone, Monitor } from 'lucide-react';

interface Props {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: Props) {
  const [view, setView] = useState<'LOGIN' | 'FORGOT' | 'FORGOT_SUCCESS' | '2FA'>('LOGIN');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 2FA state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Simulate requiring 2FA for a specific test email, otherwise login directly
      if (email === 'admin@themanvan.co.uk') {
        setView('2FA');
      } else if (password === 'wrong') {
        setError('Incorrect email or password.');
      } else {
        onLogin();
      }
    }, 1200);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setView('FORGOT_SUCCESS');
    }, 1000);
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1200);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
        
        {view === 'LOGIN' && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-8">
              <h1 className="text-[20px] font-bold text-ink mb-2">Sign in to Operations</h1>
              <p className="text-[14px] text-muted">Enter your credentials to access the dashboard</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center gap-3 text-[#B91C1C]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-[13px] font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-ink">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@themanvan.co.uk"
                    className="w-full h-11 pl-10 pr-4 rounded-full bg-surface border border-line text-[14px] text-ink focus:border-brand focus:bg-white outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-ink">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
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

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="w-4 h-4 text-brand rounded border-line focus:ring-brand cursor-pointer"
                  />
                  <span className="text-[13px] font-medium text-muted group-hover:text-ink transition-colors">Remember me</span>
                </label>
                <button 
                  type="button" 
                  onClick={() => { setView('FORGOT'); setError(''); }}
                  className="text-[13px] font-semibold text-brand hover:text-blue-700 transition-colors"
                >
                  Forgot password?
                </button>
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
        )}

        {view === 'FORGOT' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-200">
            <button onClick={() => setView('LOGIN')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface text-muted hover:text-ink transition-colors mb-4 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="mb-8">
              <h1 className="text-[20px] font-bold text-ink mb-2">Reset your password</h1>
              <p className="text-[14px] text-muted leading-relaxed">Enter your email address and we'll send you a link to reset your password.</p>
            </div>

            <form onSubmit={handleForgotSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-ink">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@themanvan.co.uk"
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-full bg-surface border border-line text-[14px] text-ink focus:border-brand focus:bg-white outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full h-[46px] rounded-full bg-[#1A1A1A] hover:bg-black text-white text-[14px] font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </div>
        )}

        {view === 'FORGOT_SUCCESS' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-200 text-center py-4">
            <div className="w-16 h-16 bg-status-green-bg text-status-green rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8" />
            </div>
            <h1 className="text-[20px] font-bold text-ink mb-3">Check your email</h1>
            <p className="text-[14px] text-muted leading-relaxed mb-8">
              We've sent a password reset link to <span className="font-semibold text-ink">{email}</span>. It may take a few minutes to arrive.
            </p>
            <button
              onClick={() => setView('LOGIN')}
              className="text-[14px] font-semibold text-brand hover:text-blue-700 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {view === '2FA' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-200">
             <button onClick={() => setView('LOGIN')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface text-muted hover:text-ink transition-colors mb-4 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-5">
                <Shield className="w-7 h-7" />
              </div>
              <h1 className="text-[20px] font-bold text-ink mb-2">Two-Factor Authentication</h1>
              <p className="text-[14px] text-muted">Enter the 6-digit code from your authenticator app</p>
            </div>

            <form onSubmit={handle2FASubmit} className="space-y-8">
              <div className="flex justify-between gap-2 px-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => inputRefs.current[idx] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-[20px] font-bold text-ink bg-surface border border-line rounded-[12px] focus:border-brand focus:bg-white outline-none transition-colors"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full h-[46px] rounded-full bg-[#1A1A1A] hover:bg-black text-white text-[14px] font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <button className="block w-full text-[13px] font-medium text-muted hover:text-ink transition-colors">
                Resend code
              </button>
              <button className="block w-full text-[13px] font-medium text-brand hover:text-blue-700 transition-colors">
                Use backup code instead
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-[12px] text-muted font-medium">© {new Date().getFullYear()} The Man Van Operations</p>
        <div className="flex items-center justify-center gap-4 text-[12px]">
          <a href="#" className="text-muted hover:text-ink transition-colors">Support</a>
          <a href="#" className="text-muted hover:text-ink transition-colors">Privacy Policy</a>
        </div>
      </div>

    </div>
  );
}
