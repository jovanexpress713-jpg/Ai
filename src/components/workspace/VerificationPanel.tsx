import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Clock,
  Terminal,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { translations, Language } from '../../lib/i18n';
import { runVerification, executeTerminalCommand } from '../../lib/api';

interface VerificationPanelProps {
  lang: Language;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({ lang }) => {
  const t = translations[lang];
  const [isRunning, setIsRunning] = useState(false);
  const [activeCheck, setActiveCheck] = useState<string | null>(null);
  const [results, setResults] = useState<
    Record<
      string,
      {
        success: boolean;
        command: string;
        stdout: string;
        stderr: string;
        exitCode: number;
        durationMs: number;
      }
    >
  >({});

  const handleRunCheck = async (name: 'verify' | 'lint' | 'build') => {
    setIsRunning(true);
    setActiveCheck(name);
    try {
      if (name === 'verify') {
        const term = await executeTerminalCommand('npm run verify');
        setResults((prev) => ({
          ...prev,
          verify: {
            success: term.exitCode === 0,
            command: 'npm run verify',
            stdout: term.stdout,
            stderr: term.stderr,
            exitCode: term.exitCode,
            durationMs: term.durationMs,
          },
        }));
      } else {
        const res = await runVerification(name);
        setResults((prev) => ({ ...prev, [name]: res }));
      }
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [name]: {
          success: false,
          command: `npm run ${name}`,
          stdout: '',
          stderr: err.message || 'Execution error',
          exitCode: 1,
          durationMs: 0,
        },
      }));
    } finally {
      setIsRunning(false);
      setActiveCheck(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span>{lang === 'ar' ? 'منصة التحقق والفحص الآلي' : 'Autonomous Verification & Test Suite'}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {lang === 'ar'
              ? 'تشغيل الاختبارات والتحقق البرمجي الحقيقي من صحة الأكواد والبناء'
              : 'Execute real compilation, linting and workspace health suites.'}
          </p>
        </div>

        {/* Action button: Run All */}
        <button
          onClick={async () => {
            await handleRunCheck('lint');
            await handleRunCheck('verify');
            await handleRunCheck('build');
          }}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition-all"
        >
          {isRunning ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span>{lang === 'ar' ? 'تشغيل فحص شامل' : 'Run Full Suite'}</span>
        </button>
      </div>

      {/* Verification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Check 1: Lint */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-xs text-gray-200">tsc --noEmit</span>
              {results.lint && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    results.lint.success
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {results.lint.success ? 'PASSED' : 'FAILED'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {lang === 'ar' ? 'فحص الأخطاء النوعية والتحقق من TypeScript' : 'TypeScript type checking & compile audit'}
            </p>
          </div>

          <button
            onClick={() => handleRunCheck('lint')}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-cyan-500 text-xs font-semibold text-gray-200 transition-colors"
          >
            {activeCheck === 'lint' ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>npm run lint</span>
          </button>
        </div>

        {/* Check 2: Verify */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-xs text-gray-200">verify-workspace</span>
              {results.verify && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    results.verify.success
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {results.verify.success ? 'PASSED' : 'FAILED'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {lang === 'ar' ? 'فحص صحة البيئة والملفات وقاعدة البيانات' : 'Workspace integrity & DB storage audit'}
            </p>
          </div>

          <button
            onClick={() => handleRunCheck('verify')}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-cyan-500 text-xs font-semibold text-gray-200 transition-colors"
          >
            {activeCheck === 'verify' ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>npm run verify</span>
          </button>
        </div>

        {/* Check 3: Build */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-xs text-gray-200">vite build</span>
              {results.build && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    results.build.success
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {results.build.success ? 'PASSED' : 'FAILED'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {lang === 'ar' ? 'بناء حزم الإنتاج لـ Vite والتحقق من المخرجات' : 'Production asset bundle compilation'}
            </p>
          </div>

          <button
            onClick={() => handleRunCheck('build')}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-cyan-500 text-xs font-semibold text-gray-200 transition-colors"
          >
            {activeCheck === 'build' ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>npm run build</span>
          </button>
        </div>
      </div>

      {/* Raw Output Terminal Details */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>{lang === 'ar' ? 'مخرجات الفحص الفعلية' : 'Live Verification Execution Outputs'}</span>
        </h3>

        {Object.entries(results).length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 bg-[#161b22] border border-[#30363d] rounded-2xl">
            {lang === 'ar' ? 'لم يتم تشغيل أي فحص بعد. انقر على أي فحص أعلاه لتنفيذه.' : 'No verification run yet. Click any check above to test.'}
          </div>
        ) : (
          Object.entries(results).map(([k, res]) => (
            <div key={k} className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono border-b border-[#21262d] pb-2">
                <span className="font-bold text-white">$ {res.command}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    res.success ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                  }`}
                >
                  exit {res.exitCode} ({res.durationMs}ms)
                </span>
              </div>

              {res.stdout && (
                <pre className="font-mono text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {res.stdout}
                </pre>
              )}

              {res.stderr && (
                <pre className="font-mono text-[11px] text-red-400 whitespace-pre-wrap leading-relaxed bg-red-950/20 p-2 rounded overflow-x-auto">
                  {res.stderr}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
