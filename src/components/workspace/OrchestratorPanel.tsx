import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  FileCode,
  ShieldAlert,
  Send,
  Eye,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import { AgentTask, ChatMessage, ProposedFileChange, UserRole } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface OrchestratorPanelProps {
  lang: Language;
  currentTask: AgentTask | null;
  tasks: AgentTask[];
  messages: ChatMessage[];
  onSelectTask: (task: AgentTask) => void;
  onApplyTask: (taskId: string) => void;
  onRejectTask: (taskId: string) => void;
  onSendMessage: (content: string, agent: string) => void;
  onInspectDiff: (change: ProposedFileChange) => void;
  currentRole: UserRole;
  isProcessing: boolean;
}

export const OrchestratorPanel: React.FC<OrchestratorPanelProps> = ({
  lang,
  currentTask,
  tasks,
  messages,
  onSelectTask,
  onApplyTask,
  onRejectTask,
  onSendMessage,
  onInspectDiff,
  currentRole,
  isProcessing,
}) => {
  const t = translations[lang];
  const [inputMsg, setInputMsg] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(currentTask?.assignedAgent || 'Planner');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || isProcessing) return;
    onSendMessage(inputMsg.trim(), selectedAgent);
    setInputMsg('');
  };

  const isRtl = lang === 'ar';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="h-full flex flex-col lg:flex-row bg-[#0d1117] text-gray-200 overflow-hidden">
      {/* Left Column: Autonomous Cycle Pipeline & Diffs (60%) */}
      <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-[#30363d] overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Active Task Header */}
        {currentTask ? (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">
                    {currentTask.title}
                  </h2>
                  <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                    <span className="text-cyan-400 font-semibold">{currentTask.assignedAgent}</span>
                    <span>•</span>
                    <span>{new Date(currentTask.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  currentTask.state === 'COMPLETED'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                    : currentTask.state === 'WAITING_APPROVAL'
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-700 animate-pulse'
                    : currentTask.state === 'FAILED'
                    ? 'bg-red-950/80 text-red-300 border border-red-700'
                    : 'bg-cyan-950/80 text-cyan-300 border border-cyan-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {t.cycleStates[currentTask.state] || currentTask.state}
              </span>
            </div>

            <p className="text-xs text-gray-300 bg-[#0d1117] p-3 rounded-xl border border-[#21262d] font-mono leading-relaxed">
              {currentTask.description}
            </p>

            {/* Error banner if failed */}
            {currentTask.error && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{lang === 'ar' ? 'سبب التوقف:' : 'Failure Reason:'} </span>
                  <span>{currentTask.error}</span>
                </div>
              </div>
            )}

            {/* Cycle Steps Progression */}
            <div className="mt-5 pt-4 border-t border-[#21262d]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{lang === 'ar' ? 'مراحل التنفيذ الذاتي' : 'Autonomous Cycle Progression'}</span>
              </h3>

              <div className="space-y-3">
                {currentTask.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <div className="mt-0.5">
                      {step.state === 'COMPLETED' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : step.state === 'FAILED' ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-200">{step.title}</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {step.detail && (
                        <p className="text-gray-400 mt-0.5 text-[11px] font-mono leading-relaxed">
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proposed File Changes & Approval Buttons */}
            {currentTask.proposedChanges && currentTask.proposedChanges.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[#21262d]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {lang === 'ar' ? 'التغييرات المقترحة على الملفات' : 'Proposed File Changes'} (
                      {currentTask.proposedChanges.length})
                    </span>
                  </h3>
                </div>

                <div className="space-y-2 mb-4">
                  {currentTask.proposedChanges.map((change, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between text-xs hover:border-gray-500 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-mono text-gray-200">{change.filePath}</span>
                        {change.applied && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Applied
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-[11px] font-mono">
                          <span className="text-emerald-400">+{change.diffSummary.additions}</span>{' '}
                          <span className="text-red-400">-{change.diffSummary.deletions}</span>
                        </div>
                        <button
                          onClick={() => onInspectDiff(change)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-cyan-300 text-[11px] font-medium transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Diff</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Approval Action Bar */}
                {currentTask.state === 'WAITING_APPROVAL' && (
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-amber-200">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>{lang === 'ar' ? 'مطلوب موافقة المستخدم' : 'Approval Required'}</span>
                      </div>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        {lang === 'ar'
                          ? 'تطبيق التعديلات سيكتب على الملفات الحقيقية ويجري فحص lint آليًا.'
                          : 'Applying will write modifications to disk and trigger automated lint verification.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRejectTask(currentTask.id)}
                        disabled={isProcessing}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold border border-gray-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{t.diff.reject}</span>
                      </button>

                      <button
                        onClick={() => onApplyTask(currentTask.id)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border border-emerald-400 shadow-lg shadow-emerald-900/30 transition-all hover:scale-105"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.diff.apply}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center text-gray-400 space-y-3">
            <Bot className="w-10 h-10 mx-auto text-cyan-400" />
            <h3 className="text-base font-bold text-white">
              {lang === 'ar' ? 'لا توجد مهمة نشطة حالياً' : 'No Active Task Selected'}
            </h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              {lang === 'ar'
                ? 'اختر مهمة سابقة من القائمة، أو أرسل طلباً جديداً عبر مربع المحادثة لبدء دورة تطوير مستقلة جديدة.'
                : 'Select an existing task from history, or type a request below to start a new autonomous cycle.'}
            </p>
          </div>
        )}

        {/* Task History Quick Switcher */}
        {tasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {lang === 'ar' ? 'سجل المهام في مساحة العمل' : 'Workspace Task History'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tasks.slice(0, 4).map((tsk) => (
                <div
                  key={tsk.id}
                  onClick={() => onSelectTask(tsk)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    currentTask?.id === tsk.id
                      ? 'bg-cyan-950/30 border-cyan-500 text-cyan-200'
                      : 'bg-[#161b22] border-[#30363d] hover:border-gray-500 text-gray-300'
                  }`}
                >
                  <span className="truncate max-w-[160px] font-medium">{tsk.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-[#0d1117]">
                    {tsk.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Interactive Chat & Autonomous Request Input (40%) */}
      <div className="w-full lg:w-[420px] flex flex-col bg-[#161b22] overflow-hidden">
        {/* Chat Header */}
        <div className="p-3.5 border-b border-[#30363d] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white">
              {lang === 'ar' ? 'محادثة وتوجيه الوكيل' : 'Agent Conversation & Prompts'}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#0d1117] text-gray-400 font-mono">
            {messages.length} {lang === 'ar' ? 'رسائل' : 'msgs'}
          </span>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1 px-1">
                <span>{msg.role === 'user' ? 'You' : msg.agent || 'FORGEX Agent'}</span>
                <span>•</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <div
                className={`p-3 rounded-2xl text-xs max-w-[90%] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none shadow-md'
                    : 'bg-[#0d1117] border border-[#30363d] text-gray-200 rounded-bl-none shadow-inner font-sans'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input Box */}
        <form onSubmit={handleSend} className="p-3 border-t border-[#30363d] bg-[#0d1117] space-y-2">
          {/* Agent selection pill */}
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>{t.agentSelectorLabel}</span>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-[#161b22] border border-[#30363d] rounded px-2 py-0.5 text-cyan-300 outline-none"
            >
              <option value="Planner">Planner</option>
              <option value="Coder">Coder</option>
              <option value="UI Agent">UI Agent</option>
              <option value="Database Agent">Database Agent</option>
              <option value="Tester">Tester</option>
              <option value="Security Agent">Security Agent</option>
            </select>
          </div>

          <div className="relative">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder={lang === 'ar' ? 'أرسل طلباً برمجياً للوكيل...' : 'Instruct autonomous agent...'}
              disabled={isProcessing}
              className="w-full bg-[#161b22] border border-[#30363d] focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none pr-10"
            />
            <button
              type="submit"
              disabled={isProcessing || !inputMsg.trim()}
              className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
