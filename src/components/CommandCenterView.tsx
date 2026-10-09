import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Bot,
  Code2,
  Palette,
  Database,
  CheckCircle2,
  ShieldCheck,
  FolderGit2,
  Clock,
  Terminal,
  Play,
  FileCode,
  Layers,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { AgentTask, Project } from '../types';
import { translations, Language } from '../lib/i18n';

interface CommandCenterViewProps {
  lang: Language;
  tasks: AgentTask[];
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (proj: Project) => void;
  onSubmitPrompt: (prompt: string, agent: string, targetFiles: string[]) => void;
  onOpenTask: (task: AgentTask) => void;
  onGoToWorkspace: () => void;
  isSubmitting: boolean;
}

const AGENTS = [
  { id: 'Planner', icon: Bot, labelAr: 'المخطط المعماري', labelEn: 'Chief Planner', desc: 'Architecture, specification & execution plan' },
  { id: 'Coder', icon: Code2, labelAr: 'مهندس الكود', labelEn: 'Code Engineer', desc: 'Full-stack implementation & TypeScript types' },
  { id: 'UI Agent', icon: Palette, labelAr: 'مهندس الواجهات', labelEn: 'UI Specialist', desc: 'Responsive interfaces & accessibility' },
  { id: 'Database Agent', icon: Database, labelAr: 'مهندس البيانات', labelEn: 'Data Architect', desc: 'Schemas, storage & state modeling' },
  { id: 'Tester', icon: CheckCircle2, labelAr: 'مهندس التحقق', labelEn: 'QA & Tester', desc: 'Automated test suite, lint & build validation' },
  { id: 'Security Agent', icon: ShieldCheck, labelAr: 'مدقق الأمان', labelEn: 'Security Auditor', desc: 'Secrets safety, RBAC & path traversal checks' },
];

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  lang,
  tasks,
  projects,
  activeProject,
  onSelectProject,
  onSubmitPrompt,
  onOpenTask,
  onGoToWorkspace,
  isSubmitting,
}) => {
  const t = translations[lang];
  const [prompt, setPrompt] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('Planner');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    onSubmitPrompt(prompt.trim(), selectedAgent, selectedFiles);
    setPrompt('');
  };

  const isRtl = lang === 'ar';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-[calc(100vh-50px)] bg-[#0d1117] text-gray-100 flex flex-col justify-between p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Top Welcome Section */}
      <div className="flex flex-col items-center text-center mt-4 sm:mt-8 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs font-semibold shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span>{lang === 'ar' ? 'محرك الذكاء الاصطناعي الذاتي' : 'Autonomous Engineering Engine'}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-2xl leading-tight">
          {t.homeTitle}
        </h1>

        <p className="text-sm sm:text-base text-gray-400 max-w-2xl">
          {t.homeSubtitle}
        </p>
      </div>

      {/* Main Interactive Prompt Box */}
      <div className="w-full my-8 bg-[#161b22] border border-[#30363d] rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Project selector row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#21262d] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">
              {lang === 'ar' ? 'المشروع النشط:' : 'Active Project:'}
            </span>
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="bg-[#0d1117] border border-[#30363d] rounded-md px-2.5 py-1 text-cyan-300 font-medium outline-none focus:border-cyan-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#161b22] text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onGoToWorkspace}
            className="flex items-center gap-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.viewWorkspace}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Text Area */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.promptPlaceholder}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-cyan-500 rounded-xl p-4 text-sm text-gray-100 placeholder-gray-500 outline-none resize-none font-sans leading-relaxed transition-all shadow-inner"
            />
          </div>

          {/* Agent Selector Badges */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">
              {t.agentSelectorLabel}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {AGENTS.map((ag) => {
                const Icon = ag.icon;
                const isSelected = selectedAgent === ag.id;
                return (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => setSelectedAgent(ag.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-xs text-center ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/50'
                        : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-cyan-400' : 'text-gray-400'}`} />
                    <span className="font-semibold">{lang === 'ar' ? ag.labelAr : ag.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-gray-500">
              {lang === 'ar' ? 'اضغط Ctrl+Enter للإرسال الفوري' : 'Press Ctrl+Enter to trigger cycle'}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${
                isSubmitting || !prompt.trim()
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-[#30363d]'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400 shadow-cyan-900/40 hover:scale-[1.01]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{lang === 'ar' ? 'جاري التحليل والتنفيذ...' : 'Running Cycle...'}</span>
                </>
              ) : (
                <>
                  <span>{t.runAgentBtn}</span>
                  <ArrowIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Grids: Previous Tasks & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Column 1 & 2: Recent Real Tasks from DB */}
        <div className="md:col-span-2 bg-[#161b22] border border-[#30363d] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>{t.recentTasks}</span>
            </div>
            <span className="text-xs bg-[#21262d] px-2 py-0.5 rounded text-gray-400 font-mono">
              {tasks.length} {lang === 'ar' ? 'مهام' : 'tasks'}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-600" />
              <p>{t.noTasksYet}</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {tasks.slice(0, 5).map((tsk) => (
                <div
                  key={tsk.id}
                  onClick={() => onOpenTask(tsk)}
                  className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-cyan-500/50 hover:bg-[#161b22] transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        tsk.state === 'COMPLETED'
                          ? 'bg-emerald-400'
                          : tsk.state === 'WAITING_APPROVAL'
                          ? 'bg-amber-400 ring-2 ring-amber-950'
                          : tsk.state === 'FAILED'
                          ? 'bg-red-400'
                          : 'bg-cyan-400 animate-pulse'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-semibold text-gray-200 group-hover:text-cyan-300 transition-colors">
                        {tsk.title}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                        <span className="text-cyan-400/80">{tsk.assignedAgent}</span>
                        <span>•</span>
                        <span>{new Date(tsk.createdAt).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>{tsk.proposedChanges?.length || 0} files</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      tsk.state === 'COMPLETED'
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                        : tsk.state === 'WAITING_APPROVAL'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                        : tsk.state === 'FAILED'
                        ? 'bg-red-950/60 text-red-300 border border-red-800'
                        : 'bg-cyan-950/60 text-cyan-300 border border-cyan-800'
                    }`}
                  >
                    {t.cycleStates[tsk.state] || tsk.state}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Quick Commands & Verification Tools */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-200 mb-3">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'ar' ? 'أدوات التحقق السريع' : 'Verification Suites'}</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {lang === 'ar'
                ? 'فحص بيئة التطوير الحقيقية وتشغيل أوامر الفحص والتحقق الفوري'
                : 'Run live scripts directly inside workspace container'}
            </p>

            <div className="space-y-2">
              <button
                onClick={onGoToWorkspace}
                className="w-full text-left p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-cyan-500 text-xs font-mono text-gray-300 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3 h-3 text-cyan-400" />
                  <span>npm run verify</span>
                </div>
                <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-cyan-400" />
              </button>

              <button
                onClick={onGoToWorkspace}
                className="w-full text-left p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-cyan-500 text-xs font-mono text-gray-300 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3 h-3 text-cyan-400" />
                  <span>npm run lint</span>
                </div>
                <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-cyan-400" />
              </button>

              <button
                onClick={onGoToWorkspace}
                className="w-full text-left p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-cyan-500 text-xs font-mono text-gray-300 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3 h-3 text-cyan-400" />
                  <span>npm run build</span>
                </div>
                <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-cyan-400" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#21262d] text-center">
            <span className="text-[11px] text-gray-500">
              {lang === 'ar' ? 'البيانات تُحفظ مستمرة في SQLite/JSON' : 'Persistent Storage: Active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
