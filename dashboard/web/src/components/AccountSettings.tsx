import React, { useState } from 'react';
import { User, Shield, AlertTriangle, Monitor, Smartphone, Upload, Trash2, CheckCircle2 } from 'lucide-react';

export function AccountSettings() {
  const [profile, setProfile] = useState({
    name: 'Washington Carrato',
    email: 'washington@themanvan.co.uk',
    phone: '07700 900000',
  });
  
  const [passForm, setPassForm] = useState({
    current: '',
    newPass: '',
    confirm: ''
  });

  const reqs = {
    length: passForm.newPass.length >= 8,
    upper: /[A-Z]/.test(passForm.newPass),
    number: /[0-9]/.test(passForm.newPass),
    symbol: /[^A-Za-z0-9]/.test(passForm.newPass)
  };
  const passStrength = Object.values(reqs).filter(Boolean).length;
  
  const handleProfileChange = (key: string, val: string) => setProfile(prev => ({ ...prev, [key]: val }));
  const handlePassChange = (key: string, val: string) => setPassForm(prev => ({ ...prev, [key]: val }));

  const [tfaEnabled, setTfaEnabled] = useState(true);

  return (
    <div className="space-y-6 flex flex-col md:w-full lg:w-[800px]">
      
      {/* PROFILE CARD */}
      <div className="bg-white rounded-[20px] border border-line shadow-[0_4px_24px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="p-6 pb-8 border-b border-line">
          <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-muted" /> Profile
          </h3>

          <div className="flex flex-col sm:flex-row items-start gap-8">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-blue-100 text-brand flex items-center justify-center text-[32px] font-bold shadow-sm">
                WC
              </div>
              <div className="flex flex-col items-center gap-2">
                <button className="flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:text-blue-700 transition">
                  <Upload className="w-3.5 h-3.5" /> Upload photo
                </button>
                <button className="flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink transition">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>

            {/* Fields */}
            <div className="flex-1 space-y-4 w-full">
              <div>
                <label className="block text-[12px] font-bold text-muted uppercase tracking-wider mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  value={profile.name}
                  onChange={e => handleProfileChange('name', e.target.value)}
                  className="w-full h-11 px-3 rounded-[10px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-muted uppercase tracking-wider mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  value={profile.email}
                  onChange={e => handleProfileChange('email', e.target.value)}
                  className="w-full h-11 px-3 rounded-[10px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[12px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input 
                    type="tel" 
                    value={profile.phone}
                    onChange={e => handleProfileChange('phone', e.target.value)}
                    className="w-full h-11 px-3 rounded-[10px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] font-bold text-muted uppercase tracking-wider mb-1.5">Role</label>
                  <input 
                    type="text" 
                    value="Super Admin"
                    readOnly
                    disabled
                    className="w-full h-11 px-3 rounded-[10px] border border-line bg-[#F3F4F6] text-[14px] font-semibold text-muted outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-surface flex items-center justify-between text-[12px] font-medium text-muted">
          <span>Account created: 12/03/2024</span>
          <span>Last login: Today, 08:42 AM</span>
        </div>
      </div>

      {/* SECURITY CARD */}
      <div className="bg-white rounded-[20px] border border-line shadow-[0_4px_24px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="p-6">
          <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-muted" /> Security
          </h3>

          {/* Change Password */}
          <details className="group mb-8">
            <summary className="list-none cursor-pointer flex items-center justify-between py-3 border-b border-line font-medium text-[14px] text-ink select-none">
              Change Password
              <span className="text-[20px] text-muted group-open:rotate-180 transition-transform">↓</span>
            </summary>
            
            <div className="pt-6 space-y-6 max-w-[400px]">
              <div>
                <label className="block text-[12px] font-bold text-muted uppercase tracking-wider mb-1.5">Current Password</label>
                <input 
                  type="password" 
                  value={passForm.current}
                  onChange={e => handlePassChange('current', e.target.value)}
                  className="w-full h-11 px-3 rounded-[10px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-muted uppercase tracking-wider mb-1.5">New Password</label>
                <input 
                  type="password" 
                  value={passForm.newPass}
                  onChange={e => handlePassChange('newPass', e.target.value)}
                  className="w-full h-11 px-3 rounded-[10px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                />
                <div className="flex gap-1 mt-2">
                  <div className={`h-1 flex-1 rounded-full ${passStrength >= 1 ? 'bg-status-red' : 'bg-line'}`} />
                  <div className={`h-1 flex-1 rounded-full ${passStrength >= 2 ? (passStrength >= 3 ? 'bg-status-green' : 'bg-amber-400') : 'bg-line'}`} />
                  <div className={`h-1 flex-1 rounded-full ${passStrength >= 3 ? 'bg-status-green' : 'bg-line'}`} />
                  <div className={`h-1 flex-1 rounded-full ${passStrength >= 4 ? 'bg-status-green' : 'bg-line'}`} />
                </div>
                
                <div className="mt-3 space-y-1.5 text-[12px] font-medium text-muted">
                  <div className={`flex items-center gap-2 ${reqs.length ? 'text-status-green' : ''}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 8+ characters
                  </div>
                  <div className={`flex items-center gap-2 ${reqs.upper ? 'text-status-green' : ''}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1 uppercase letter
                  </div>
                  <div className={`flex items-center gap-2 ${reqs.number ? 'text-status-green' : ''}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1 number
                  </div>
                  <div className={`flex items-center gap-2 ${reqs.symbol ? 'text-status-green' : ''}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1 special character
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-[12px] font-bold text-muted uppercase tracking-wider mb-1.5">Confirm New Password</label>
                <input 
                  type="password" 
                  value={passForm.confirm}
                  onChange={e => handlePassChange('confirm', e.target.value)}
                  className="w-full h-11 px-3 rounded-[10px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                />
              </div>

              <button 
                disabled={passStrength < 4 || passForm.newPass !== passForm.confirm || !passForm.current}
                className="h-[40px] px-6 rounded-[10px] bg-[#1A1A1A] hover:bg-black text-white text-[13px] font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Password
              </button>
            </div>
          </details>

          {/* 2FA Toggle */}
          <div className="flex items-start justify-between py-4 border-b border-line">
            <div>
              <span className="block text-[14px] font-semibold text-ink">Two-Factor Authentication (2FA)</span>
              <span className="block text-[13px] text-muted mt-1 max-w-[400px]">
                Add an extra layer of security. {tfaEnabled ? 'Authenticator app connected.' : 'Not configured.'}
              </span>
              {tfaEnabled && (
                <button className="text-[12px] font-semibold text-brand mt-2 hover:underline">Reconfigure</button>
              )}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={tfaEnabled}
                onChange={e => setTfaEnabled(e.target.checked)}
                className="w-10 h-5 bg-line rounded-full appearance-none relative before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:bg-brand checked:before:translate-x-5 transition-all cursor-pointer shadow-inner"
              />
            </label>
          </div>

          {/* Active Sessions */}
          <div className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[14px] font-semibold text-ink">Active Sessions</span>
              <button className="text-[12px] font-medium text-brand hover:underline">Sign out all other sessions</button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start justify-between p-3 rounded-lg border border-brand bg-brand/5">
                <div className="flex items-start gap-3">
                  <Monitor className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[13px] font-semibold text-ink">Mac OS • Chrome</span>
                    <span className="block text-[12px] text-muted mt-0.5">London, UK • Active now</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start justify-between p-3 rounded-lg border border-transparent hover:bg-surface transition">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-muted shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[13px] font-semibold text-ink">iPhone 14 • Safari</span>
                    <span className="block text-[12px] text-muted mt-0.5">London, UK • Last active: 2 hours ago</span>
                  </div>
                </div>
                <button className="text-[12px] font-medium text-muted hover:text-ink">Sign out</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-white rounded-[20px] border border-red-200 shadow-sm overflow-hidden p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-red-50/30 pointer-events-none" />
        <div className="relative">
          <h3 className="text-[15px] font-semibold text-status-red flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5" /> Danger Zone
          </h3>
          
          <div className="flex items-center justify-between py-4 border-b border-red-100">
            <div>
              <span className="block text-[14px] font-semibold text-ink">Log out</span>
              <span className="block text-[13px] text-muted mt-1">End your current session securely.</span>
            </div>
            <button className="h-9 px-4 rounded-[10px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium transition shadow-sm">
              Log out
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4">
            <div>
              <span className="block text-[14px] font-semibold text-ink">Deactivate Account</span>
              <span className="block text-[13px] text-muted mt-1">Permanently revoke your admin access to The Man Van.</span>
            </div>
            <button className="h-9 px-4 rounded-[10px] bg-[#FEF2F2] hover:bg-red-100 text-status-red text-[13px] font-medium transition shadow-sm whitespace-nowrap">
              Deactivate Account...
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
