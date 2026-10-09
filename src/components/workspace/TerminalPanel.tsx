import React, { useState } from 'react';
import {
  Terminal as TermIcon,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { TerminalEntry } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface TerminalPanelProps {
  lang: Language;
  history: TerminalEntry[];
  onExecuteCommand: (cmd: string) => void;
  isRunning: boolean;
  canExecute: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  lang,
  history,
  onExecuteCommand,
  isRunning,
  canExecute,
}) => {
  const t = translations[lang];
  const [commandInput, setCommandInput] = useState('');

  const handleRun = (cmdToRun?: string) => {
    const cmd = (cmdToRun || commandInput).trim();
    if (!cmd || isRunning || !canExecute) return;
    onExecuteCommand(cmd);
    setCommandInput('');
  };

  const QUICK_COMMANDS = [
    'npm run verify',
    'npm run lint',
    'npm run build',
    'git status',
    'ls -la',
    'node -v',
  ];

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-hidden font-mono text-xs">
      {/* Top Header */}
      <div className="p-3 bg-[#161b22] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TermIcon className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white">{t.terminal.title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#0d1117] text-emerald-400 border border-emerald-800">
            CWD: /app/applet (Workspace Root)
          </span>
        </div>

        {/* Quick Suggest Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_COMMANDS.map((qc) => (
            <button
              key={qc}
              onClick={() => handleRun(qc)}
              disabled={isRunning || !canExecute}
              className="px-2 py-1 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-cyan-500 text-[11px] text-gray-300 transition-colors"
            >
              {qc}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0d12]">
        {history.length === 0 ? (
          <div className="text-gray-500 text-center py-12 space-y-2">
            <TermIcon className="w-8 h-8 mx-auto text-gray-600" />
            <p>{lang === 'ar' ? 'سطر الأوامر جاهز. اكتب أمراً أو اختر من الأوامر السريعة أعلاه.' : 'Terminal ready. Type a command or click a quick suggestion.'}</p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="p-3.5 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2 shadow-sm"
            >
              {/* Command Header */}
              <div className="flex items-center justify-between border-b border-[#21262d] pb-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">$</span>
                  <span className="text-gray-100 font-bold">{entry.command}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-400">
                  <span className="flex items-center gap-1 text-[10px]">
                    <Clock className="w-3 h-3" />
                    {entry.durationMs}ms
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      entry.status === 'SUCCESS'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : entry.status === 'REJECTED'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-red-950 text-red-400 border border-red-800'
                    }`}
                  >
                    exit {entry.exitCode}
                  </span>
                </div>
              </div>

              {/* Stdout */}
              {entry.stdout && (
                <pre className="text-gray-300 whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed">
                  {entry.stdout}
                </pre>
              )}

              {/* Stderr */}
              {entry.stderr && (
                <pre className="text-red-400 whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed bg-red-950/20 p-2 rounded">
                  {entry.stderr}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      {/* Terminal Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRun();
        }}
        className="p-3 bg-[#161b22] border-t border-[#30363d] flex items-center gap-2"
      >
        <div className="text-cyan-400 font-bold text-sm pl-2">$</div>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder={t.terminal.placeholder}
          disabled={isRunning || !canExecute}
          className="flex-1 bg-[#0d1117] border border-[#30363d] focus:border-cyan-500 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
        />

        <button
          type="submit"
          disabled={isRunning || !canExecute || !commandInput.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 text-white font-bold transition-all text-xs"
        >
          {isRunning ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span>{t.terminal.runBtn}</span>
        </button>
      </form>
    </div>
  );
};
