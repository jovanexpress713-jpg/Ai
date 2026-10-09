import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  UserCheck,
  FileText,
  AlertTriangle,
  Terminal,
  Clock,
  Key,
} from 'lucide-react';
import { UserRole, AuditLog } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface SecurityAuditPanelProps {
  lang: Language;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  auditLogs: AuditLog[];
}

export const SecurityAuditPanel: React.FC<SecurityAuditPanelProps> = ({
  lang,
  currentRole,
  onRoleChange,
  auditLogs,
}) => {
  const t = translations[lang];

  const PERMISSION_MATRIX = [
    { action: 'READ_FILES', label: 'قراءة الملفات والمشروع', owner: true, admin: true, dev: true, rev: true, view: true },
    { action: 'EDIT_FILES', label: 'تعديل وحفظ الملفات', owner: true, admin: true, dev: true, rev: false, view: false },
    { action: 'APPLY_CHANGES', label: 'تطبيق تغييرات الوكيل (Diff)', owner: true, admin: true, dev: true, rev: false, view: false },
    { action: 'TERMINAL_EXEC', label: 'تنفيذ أوامر Shell / Terminal', owner: true, admin: true, dev: false, rev: false, view: false },
    { action: 'MANAGE_GITHUB', label: 'إنشاء Pull Request و Commits', owner: true, admin: true, dev: true, rev: false, view: false },
    { action: 'DEPLOY', label: 'تشغيل أوامر النشر (Deploy)', owner: true, admin: true, dev: false, rev: false, view: false },
    { action: 'MANAGE_RBAC', label: 'تعديل أدوار المستخدمين والأمان', owner: true, admin: false, dev: false, rev: false, view: false },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>{lang === 'ar' ? 'الأمان وتدقيق الصلاحيات (RBAC)' : 'Security & RBAC Access Matrix'}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {lang === 'ar'
              ? 'نظام تحكم بالصلاحيات معزول ومفروض على مستوى الخادم (Server-Enforced RBAC)'
              : 'Strict server-enforced role-based access control protecting files and execution.'}
          </p>
        </div>

        {/* Role Selector */}
        <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] p-1.5 rounded-xl text-xs">
          <span className="text-gray-400 font-semibold px-2">{lang === 'ar' ? 'الدور الفعال:' : 'Active Role:'}</span>
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            className="bg-[#0d1117] text-amber-300 font-bold border border-[#30363d] rounded-lg px-2.5 py-1 outline-none"
          >
            <option value="Owner">Owner (مالك)</option>
            <option value="Admin">Admin (مدير)</option>
            <option value="Developer">Developer (مطور)</option>
            <option value="Reviewer">Reviewer (مراجع)</option>
            <option value="Viewer">Viewer (مشاهد)</option>
          </select>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-[#21262d] flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            {lang === 'ar' ? 'مصفوفة الصلاحيات حسب الدور' : 'Role-Based Access Control Matrix'}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0d1117] text-gray-400 uppercase font-mono text-[11px] border-b border-[#21262d]">
              <tr>
                <th className="py-2.5 px-4">{lang === 'ar' ? 'العملية / الإجراء' : 'Action / Capability'}</th>
                <th className="py-2.5 px-3 text-center">Owner</th>
                <th className="py-2.5 px-3 text-center">Admin</th>
                <th className="py-2.5 px-3 text-center">Developer</th>
                <th className="py-2.5 px-3 text-center">Reviewer</th>
                <th className="py-2.5 px-3 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]">
              {PERMISSION_MATRIX.map((perm) => (
                <tr key={perm.action} className="hover:bg-[#1a202c]/50">
                  <td className="py-2.5 px-4 font-medium text-gray-200">
                    <div>{lang === 'ar' ? perm.label : perm.action}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{perm.action}</div>
                  </td>
                  <td className="text-center py-2.5 px-3">
                    <span className="text-emerald-400 font-bold">✓</span>
                  </td>
                  <td className="text-center py-2.5 px-3">
                    {perm.admin ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-gray-600">✕</span>}
                  </td>
                  <td className="text-center py-2.5 px-3">
                    {perm.dev ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-gray-600">✕</span>}
                  </td>
                  <td className="text-center py-2.5 px-3">
                    {perm.rev ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-gray-600">✕</span>}
                  </td>
                  <td className="text-center py-2.5 px-3">
                    {perm.view ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-gray-600">✕</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs Feed */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {lang === 'ar' ? 'سجل التدقيق الأمني (Audit Logs)' : 'Security Audit Trail'}
            </h3>
          </div>
          <span className="text-[10px] bg-[#0d1117] px-2 py-0.5 rounded text-gray-400 font-mono">
            {auditLogs.length} events
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    log.type === 'SECURITY'
                      ? 'bg-red-950 text-red-400 border border-red-800'
                      : log.type === 'FILE'
                      ? 'bg-blue-950 text-blue-400 border border-blue-800'
                      : log.type === 'TERMINAL'
                      ? 'bg-purple-950 text-purple-400 border border-purple-800'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {log.type}
                </span>
                <span className="text-gray-300 font-sans">{log.message}</span>
              </div>

              <div className="text-[10px] text-gray-500 flex items-center gap-2">
                <span>{log.user}</span>
                <span>•</span>
                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
