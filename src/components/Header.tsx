import React from 'react';
import {
  Sparkles,
  Server,
  Database,
  GitBranch,
  ShieldAlert,
  Cpu,
  Layers,
  Globe,
  Activity,
  Terminal,
} from 'lucide-react';
import { SystemHealthData, UserRole } from '../types';
import { translations, Language } from '../lib/i18n';

interface HeaderProps {
  currentView: 'home' | 'workspace';
  onViewChange: (view: 'home' | 'workspace') => void;
  health: SystemHealthData | null;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onOpenHealthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  health,
  currentRole,
  onRoleChange,
  lang,
  onLangChange,
  onOpenHealthModal,
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#161b22] border-b border-[#30363d] px-4 py-2.5 flex items-center justify-between text-sm select-none">
      {/* Brand & Mode switch */}
      <div className="flex items-center gap-3">
        <div
          onClick={() => onViewChange('home')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-white shadow-md shadow-cyan-900/40">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-wide text-white text-base leading-tight">
              FORGEX <span className="text-cyan-400">AI</span>
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Autonomous Studio
            </span>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="hidden sm:flex items-center bg-[#0d1117] p-1 rounded-lg border border-[#30363d] ms-4">
          <button
            onClick={() => onViewChange('home')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              currentView === 'home'
                ? 'bg-[#21262d] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.backToHome}
          </button>
          <button
            onClick={() => onViewChange('workspace')}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              currentView === 'workspace'
                ? 'bg-[#21262d] text-cyan-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {t.viewWorkspace}
          </button>
        </div>
      </div>

      {/* Middle status badges */}
      <div className="hidden md:flex items-center gap-2">
        {/* Gemini status */}
        <div
          onClick={onOpenHealthModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d] cursor-pointer hover:border-gray-500 transition-colors text-xs"
          title="Gemini 3 API Connection Status"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-gray-300 font-mono">Gemini</span>
          <span
            className={`w-2 h-2 rounded-full ${
              health?.gemini.status === 'connected'
                ? 'bg-emerald-400 ring-2 ring-emerald-950 animate-pulse'
                : 'bg-amber-500'
            }`}
          />
        </div>

        {/* Sandbox status */}
        <div
          onClick={onOpenHealthModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d] cursor-pointer hover:border-gray-500 transition-colors text-xs"
          title="Sandbox / MicroVM status"
        >
          <Server className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-300 font-mono">Sandbox</span>
          <span
            className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
              health?.sandbox.status === 'connected'
                ? 'bg-emerald-900/60 text-emerald-300'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {health?.sandbox.status === 'connected' ? 'Active' : 'Not Configured'}
          </span>
        </div>

        {/* DB status */}
        <div
          onClick={onOpenHealthModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d] cursor-pointer hover:border-gray-500 transition-colors text-xs"
          title="Database Persistence"
        >
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-gray-300 font-mono">DB</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>

        {/* GitHub status */}
        <div
          onClick={onOpenHealthModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d] cursor-pointer hover:border-gray-500 transition-colors text-xs"
          title="GitHub Sync Status"
        >
          <GitBranch className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-gray-300 font-mono">GitHub</span>
          <span
            className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
              health?.github.status === 'connected'
                ? 'bg-emerald-900/60 text-emerald-300'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {health?.github.status === 'connected' ? 'Connected' : 'Not Configured'}
          </span>
        </div>

        <button
          onClick={onOpenHealthModal}
          className="p-1 rounded bg-[#0d1117] border border-[#30363d] hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors"
          title="Open System Diagnostics"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right controls: Role & Language */}
      <div className="flex items-center gap-2.5">
        {/* RBAC Role Selector */}
        <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#30363d] px-2 py-1 rounded-md text-xs">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            className="bg-transparent text-gray-200 outline-none cursor-pointer text-xs font-medium"
            title="Current RBAC Role"
          >
            <option value="Owner" className="bg-[#161b22] text-white">Owner</option>
            <option value="Admin" className="bg-[#161b22] text-white">Admin</option>
            <option value="Developer" className="bg-[#161b22] text-white">Developer</option>
            <option value="Reviewer" className="bg-[#161b22] text-white">Reviewer</option>
            <option value="Viewer" className="bg-[#161b22] text-white">Viewer</option>
          </select>
        </div>

        {/* Language switcher */}
        <button
          onClick={() => onLangChange(lang === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d] hover:bg-[#21262d] text-gray-300 hover:text-white transition-colors text-xs font-bold"
          title="Toggle Language / تبديل اللغة"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>
    </header>
  );
};
