import React, { useState } from 'react';
import {
  Activity,
  X,
  Cpu,
  GitBranch,
  Database,
  Server,
  Layers,
  CloudUpload,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { SystemHealthData } from '../types';
import { translations, Language } from '../lib/i18n';
import { testGemini } from '../lib/api';

interface HealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: SystemHealthData | null;
  onRefreshHealth: () => void;
  lang: Language;
}

export const HealthModal: React.FC<HealthModalProps> = ({
  isOpen,
  onClose,
  health,
  onRefreshHealth,
  lang,
}) => {
  const t = translations[lang];
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestOutput, setGeminiTestOutput] = useState<any>(null);

  if (!isOpen) return null;

  const handleRunGeminiTest = async () => {
    setTestingGemini(true);
    setGeminiTestOutput(null);
    try {
      const res = await testGemini();
      setGeminiTestOutput(res);
      onRefreshHealth();
    } catch (e: any) {
      setGeminiTestOutput({ success: false, status: 'Error', message: e.message });
    } finally {
      setTestingGemini(false);
    }
  };

  const services = [
    {
      id: 'gemini',
      name: 'Google Gemini 3 (AI Engine)',
      icon: Cpu,
      data: health?.gemini,
      hasAction: true,
    },
    {
      id: 'github',
      name: 'GitHub REST API Sync',
      icon: GitBranch,
      data: health?.github,
    },
    {
      id: 'database',
      name: 'Persistent Database Storage',
      icon: Database,
      data: health?.database,
    },
    {
      id: 'executionEnv',
      name: 'Node.js Execution Runtime',
      icon: Server,
      data: health?.executionEnv,
    },
    {
      id: 'sandbox',
      name: 'MicroVM / Sandbox Isolation',
      icon: Server,
      data: health?.sandbox,
    },
    {
      id: 'preview',
      name: 'Application Web Preview (Port 3000)',
      icon: Layers,
      data: health?.preview,
    },
    {
      id: 'deployment',
      name: 'Cloud Run & Production Release',
      icon: CloudUpload,
      data: health?.deployment,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">
              {lang === 'ar' ? 'فحص تكاملات وخدمات FORGEX AI' : 'Integration & Service Health'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshHealth}
              className="p-1.5 rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors"
              title="Refresh Health"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="space-y-3">
            {services.map((svc) => {
              const Icon = svc.icon;
              const isConnected = svc.data?.status === 'connected';

              return (
                <div
                  key={svc.id}
                  className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[#161b22] text-cyan-400 border border-[#21262d]">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{svc.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {svc.data?.reason || (isConnected ? 'Operational & Ready' : 'Standby')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          isConnected
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {isConnected ? 'Connected' : 'Not Configured'}
                      </span>

                      {svc.hasAction && (
                        <button
                          onClick={handleRunGeminiTest}
                          disabled={testingGemini}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-all"
                        >
                          {testingGemini ? (
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          <span>Test</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Additional diagnostic box for Gemini if test ran */}
                  {svc.id === 'gemini' && geminiTestOutput && (
                    <div className="mt-2 p-3 rounded-lg bg-[#161b22] border border-[#21262d] font-mono text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={geminiTestOutput.success ? 'text-emerald-400' : 'text-amber-400'}>
                          Result: {geminiTestOutput.status}
                        </span>
                        {geminiTestOutput.result?.latencyMs && (
                          <span className="text-gray-400">
                            Latency: {geminiTestOutput.result.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300">{geminiTestOutput.message}</p>
                      {geminiTestOutput.result?.responsePreview && (
                        <pre className="text-gray-400 text-[10px] bg-[#0d1117] p-2 rounded overflow-x-auto">
                          {geminiTestOutput.result.responsePreview}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#30363d] bg-[#0d1117] text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-200 text-xs font-semibold transition-colors"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
