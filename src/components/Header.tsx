import React from 'react';
import { Sparkles, Server, GitBranch, ShieldAlert, Cpu, Globe, Activity } from 'lucide-react';
import { SystemHealthData, UserRole } from '../types';
import { Language } from '../lib/i18n';

interface HeaderProps {
  currentView: 'studio' | 'home' | 'workspace';
  onViewChange: (view: 'studio' | 'home' | 'workspace') => void;
  health: SystemHealthData | null;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onOpenHealthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onViewChange, health, currentRole, onRoleChange, lang, onLangChange, onOpenHealthModal,
}) => {
  const rtl = lang === 'ar';
  return (
    <header className="forge-topbar" dir={rtl ? 'rtl' : 'ltr'}>
      <button type="button" onClick={() => onViewChange('studio')} className="forge-topbar-brand">
        <span className="forge-brand-mark"><Sparkles size={18} /></span>
        <span><strong>FORGEX <i>AI</i></strong><small>ENGINEERING & CREATIVE WORKSPACE</small></span>
      </button>

      <div className="forge-topbar-status">
        <button type="button" onClick={onOpenHealthModal} className="forge-status-chip" title={rtl ? 'حالة اتصال Gemini' : 'Gemini connection status'}>
          <Cpu size={14} /><span>Gemini</span><b className={health?.gemini.status === 'connected' ? 'is-connected' : 'is-unavailable'} />
        </button>
        <button type="button" onClick={onOpenHealthModal} className="forge-status-chip">
          <Server size={14} /><span>Sandbox</span><em>{health?.sandbox.status === 'connected' ? (rtl ? 'نشط' : 'Active') : (rtl ? 'غير مهيأ' : 'Not configured')}</em>
        </button>
        <button type="button" onClick={onOpenHealthModal} className="forge-status-chip">
          <GitBranch size={14} /><span>GitHub</span><em>{health?.github.status === 'connected' ? (rtl ? 'متصل' : 'Connected') : (rtl ? 'غير مهيأ' : 'Not configured')}</em>
        </button>
      </div>

      <div className="forge-topbar-actions">
        <button type="button" onClick={onOpenHealthModal} className="forge-icon-button" title={rtl ? 'تشخيص النظام' : 'System diagnostics'}><Activity size={16} /></button>
        <label className="forge-role-select">
          <ShieldAlert size={14} />
          <select value={currentRole} onChange={(event) => onRoleChange(event.target.value as UserRole)} aria-label={rtl ? 'الدور الحالي' : 'Current role'}>
            <option value="Owner">Owner</option><option value="Admin">Admin</option><option value="Developer">Developer</option><option value="Reviewer">Reviewer</option><option value="Viewer">Viewer</option>
          </select>
        </label>
        <button type="button" onClick={() => onLangChange(lang === 'ar' ? 'en' : 'ar')} className="forge-language-button">
          <Globe size={14} /><span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>
      </div>
    </header>
  );
};
