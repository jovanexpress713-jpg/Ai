import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  FolderGit2,
  RefreshCw,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { translations, Language } from '../../lib/i18n';
import { fetchGitHubStatus } from '../../lib/api';

interface GitHubPanelProps {
  lang: Language;
}

export const GitHubPanel: React.FC<GitHubPanelProps> = ({ lang }) => {
  const t = translations[lang];
  const [statusData, setStatusData] = useState<{
    configured: boolean;
    status: string;
    message?: string;
    user?: { login: string; name: string; avatar_url: string };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkStatus = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGitHubStatus();
      setStatusData(data);
    } catch {
      setStatusData({
        configured: false,
        status: 'Error',
        message: 'Could not contact backend GitHub status endpoint',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <span>{lang === 'ar' ? 'مزامنة وتكامل GitHub الحقيقي' : 'Real GitHub API Integration'}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {lang === 'ar'
              ? 'إدارة المستودعات، الفروع، والـ Commits وطلبات السحب (Pull Requests) الحقيقية عبر GitHub REST API'
              : 'Direct GitHub REST integration for repositories, branches, commits, and Pull Requests.'}
          </p>
        </div>

        <button
          onClick={checkStatus}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs text-gray-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{lang === 'ar' ? 'تحديث الحالة' : 'Refresh'}</span>
        </button>
      </div>

      {/* Main Connection Status Card */}
      {!statusData?.configured ? (
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">GitHub — Not Configured</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono uppercase font-bold">
                  {lang === 'ar' ? 'غير مهيأ' : 'Not Configured'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {lang === 'ar'
                  ? 'لم يتم تعيين متغير البيئة GITHUB_TOKEN. لن يتم عرض أي مستودعات تجريبية أو وهمية.'
                  : 'GITHUB_TOKEN environment variable is not provided. No mock or fake repositories will be displayed.'}
              </p>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#21262d] text-xs space-y-2">
            <div className="font-semibold text-gray-200">
              {lang === 'ar' ? 'كيفية التهيئة لربط GitHub:' : 'How to configure GitHub credentials:'}
            </div>
            <ol className="list-decimal list-inside space-y-1 text-gray-400 text-[11px] leading-relaxed">
              <li>{lang === 'ar' ? 'قم بإنشاء Personal Access Token (classic أو fine-grained) في إعدادات حسابك على GitHub.' : 'Generate a GitHub Personal Access Token in your GitHub developer settings.'}</li>
              <li>{lang === 'ar' ? 'أضف الصلاحيات المطلوبة: repo, workflow, read:user.' : 'Grant repository access scopes: repo, workflow, read:user.'}</li>
              <li>{lang === 'ar' ? 'قم بضبط متغير البيئة GITHUB_TOKEN في لوحة Secrets في AI Studio.' : 'Set GITHUB_TOKEN in your AI Studio project secrets.'}</li>
              <li>{lang === 'ar' ? 'أعد تشغيل الخادم للاتصال المباشر بالمستودعات.' : 'Restart dev server to establish live remote sync.'}</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-emerald-800/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {statusData.user?.avatar_url ? (
                <img
                  src={statusData.user.avatar_url}
                  alt="GitHub User"
                  className="w-10 h-10 rounded-full border border-purple-500"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-purple-950 flex items-center justify-center text-purple-400">
                  <GitBranch className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-white">
                  {statusData.user?.name || statusData.user?.login}
                </h3>
                <span className="text-xs text-purple-400 font-mono">@{statusData.user?.login}</span>
              </div>
            </div>

            <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold uppercase">
              Connected
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
