import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  KeyRound,
  UploadCloud,
  FolderGit2,
  Lock,
  Globe,
  FileCode,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { translations, Language } from '../../lib/i18n';
import {
  fetchGitHubStatus,
  fetchGitHubRepos,
  fetchGitHubBranches,
  syncWithGitHub,
  SyncGitHubResult,
} from '../../lib/api';

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
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Repos & Branches
  const [repos, setRepos] = useState<Array<{
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    default_branch: string;
    updated_at: string;
    private: boolean;
  }>>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // Sync Form State
  const [selectedRepo, setSelectedRepo] = useState<string>('jovanexpress713-jpg/Ai');
  const [branch, setBranch] = useState<string>('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string>('feat: sync workspace files from FORGEX AI Studio');
  const [syncScope, setSyncScope] = useState<'all' | 'custom'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<SyncGitHubResult | null>(null);
  const [showFilesList, setShowFilesList] = useState(false);

  const checkStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const data = await fetchGitHubStatus();
      setStatusData(data);
      if (data.configured) {
        loadRepos();
      }
    } catch {
      setStatusData({
        configured: false,
        status: 'Error',
        message: 'Could not contact backend GitHub status endpoint',
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const loadRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const res = await fetchGitHubRepos();
      if (res.configured && res.repos) {
        setRepos(res.repos);
        if (res.repos.length > 0) {
          // If default repo is in list, keep it, else pick first or match imported
          const matched = res.repos.find((r) => r.full_name.toLowerCase() === 'jovanexpress713-jpg/ai') || res.repos[0];
          setSelectedRepo(matched.full_name);
          setBranch(matched.default_branch || 'main');
          loadBranches(matched.full_name);
        }
      }
    } catch (e: any) {
      console.warn('Failed to load repos:', e);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const loadBranches = async (repoName: string) => {
    if (!repoName.includes('/')) return;
    setIsLoadingBranches(true);
    try {
      const res = await fetchGitHubBranches(repoName);
      if (res.success && res.branches) {
        const names = res.branches.map((b) => b.name);
        setBranches(names);
        if (names.length > 0 && !names.includes(branch)) {
          setBranch(names[0]);
        }
      }
    } catch {
      // Keep default branch
    } finally {
      setIsLoadingBranches(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleRepoChange = (newRepo: string) => {
    setSelectedRepo(newRepo);
    loadBranches(newRepo);
  };

  const handleSync = async () => {
    if (!selectedRepo.trim()) {
      setSyncError(lang === 'ar' ? 'يرجى تحديد اسم المستودع (owner/repo)' : 'Please specify repository (owner/repo)');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const result = await syncWithGitHub({
        repo: selectedRepo.trim(),
        branch: branch.trim() || 'main',
        message: commitMessage.trim() || 'Sync workspace files from FORGEX AI Studio',
      });
      setSyncSuccess(result);
    } catch (err: any) {
      setSyncError(err.message || (lang === 'ar' ? 'فشلت المزامنة مع GitHub' : 'Failed to sync with GitHub'));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <span>{lang === 'ar' ? 'مزامنة وتكامل GitHub الحقيقي' : 'Sync with GitHub Repository'}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {lang === 'ar'
              ? 'دفع ومزامنة ملفات المشروع وتعديلاته مباشرة إلى مستودع GitHub باستخدام GITHUB_TOKEN عبر Git Data API'
              : 'Directly push and synchronize workspace files to your linked GitHub repository using GITHUB_TOKEN.'}
          </p>
        </div>

        <button
          onClick={checkStatus}
          disabled={isLoadingStatus}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs text-gray-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
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
                  ? 'لم يتم تعيين متغير البيئة GITHUB_TOKEN. يُرجى ضبطه لتمكين المزامنة والدفع المباشر للمستودع.'
                  : 'GITHUB_TOKEN environment variable is not provided. Set it to enable direct push & sync.'}
              </p>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#21262d] text-xs space-y-2">
            <div className="font-semibold text-gray-200">
              {lang === 'ar' ? 'خطوات تفعيل GITHUB_TOKEN لمزامنة المستودع:' : 'Steps to configure GITHUB_TOKEN:'}
            </div>
            <ol className="list-decimal list-inside space-y-1 text-gray-400 text-[11px] leading-relaxed">
              <li>{lang === 'ar' ? 'قم بإنشاء Personal Access Token من إعدادات حسابك على GitHub (Settings → Developer Settings → Personal access tokens).' : 'Create a GitHub Personal Access Token (classic or fine-grained).'}</li>
              <li>{lang === 'ar' ? 'تأكد من تحديد صلاحيات الكتابة والمستودعات: repo, workflow, read:user.' : 'Grant repository write scopes: repo, workflow, read:user.'}</li>
              <li>{lang === 'ar' ? 'قم بإضافة المتغير GITHUB_TOKEN في إعدادات البيئة (.env أو Secrets).' : 'Add GITHUB_TOKEN to your environment variables.'}</li>
              <li>{lang === 'ar' ? 'انقر على "تحديث الحالة" للاتصال الفوري بمستودعاتك.' : 'Click "Refresh" above to establish live connection.'}</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* User Account Bar */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {statusData.user?.avatar_url ? (
                <img
                  src={statusData.user.avatar_url}
                  alt="GitHub User"
                  className="w-10 h-10 rounded-full border border-purple-500 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-purple-950 flex items-center justify-center text-purple-400">
                  <GitBranch className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{statusData.user?.name || statusData.user?.login}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                    Connected
                  </span>
                </h3>
                <span className="text-xs text-purple-400 font-mono">@{statusData.user?.login}</span>
              </div>
            </div>

            <div className="text-xs text-gray-400 flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-gray-500" />
              <span>{repos.length} {lang === 'ar' ? 'مستودع متاح' : 'repositories accessible'}</span>
            </div>
          </div>

          {/* Sync with Repository Form Card */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#30363d]">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'مزامنة ودفع التغييرات إلى المستودع (Sync with Repository)' : 'Sync with Repository'}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {lang === 'ar'
                    ? 'سيتم جمع ملفات مساحة العمل الحالية وإنشاء Commit وتحديث الفرع المختار على GitHub فوراً'
                    : 'Commits and pushes workspace files directly to your target branch on GitHub.'}
                </p>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Repository Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                  <span>{lang === 'ar' ? 'المستودع المستهدف (Repository)' : 'Target Repository'}</span>
                  {isLoadingRepos && <span className="text-[10px] text-purple-400 animate-pulse">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>}
                </label>
                {repos.length > 0 ? (
                  <select
                    value={selectedRepo}
                    onChange={(e) => handleRepoChange(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    {repos.map((r) => (
                      <option key={r.id} value={r.full_name}>
                        {r.full_name} {r.private ? '🔒' : '🌐'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedRepo}
                    onChange={(e) => handleRepoChange(e.target.value)}
                    placeholder="owner/repo (e.g. jovanexpress713-jpg/Ai)"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                )}
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>{lang === 'ar' ? 'أو أدخل المستودع يدوياً:' : 'Or custom repo:'}</span>
                  <input
                    type="text"
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="bg-transparent border-b border-[#30363d] px-1 text-[11px] text-purple-300 focus:outline-none focus:border-purple-400 w-48 text-right"
                  />
                </div>
              </div>

              {/* Branch Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                  <span>{lang === 'ar' ? 'الفرع (Branch)' : 'Target Branch'}</span>
                  {isLoadingBranches && <span className="text-[10px] text-purple-400 animate-pulse">{lang === 'ar' ? 'جاري جلب الفروع...' : 'Fetching branches...'}</span>}
                </label>
                <div className="flex gap-2">
                  {branches.length > 0 ? (
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    >
                      {branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  )}
                  <button
                    onClick={() => loadBranches(selectedRepo)}
                    disabled={isLoadingBranches}
                    className="px-2.5 py-1.5 bg-[#0d1117] border border-[#30363d] hover:bg-[#21262d] rounded-lg text-gray-400 hover:text-white text-xs"
                    title="Reload branches"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBranches ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Commit Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">
                {lang === 'ar' ? 'رسالة الـ Commit (Commit Message)' : 'Commit Message'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-gray-500">
                  <GitCommit className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="feat: sync updates from FORGEX AI Studio"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg ps-9 pe-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Sync Scope & Action Button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {lang === 'ar'
                    ? 'سيتم استثناء الملفات الحساسة تلقائياً (.env, node_modules, dist)'
                    : 'Security excluded: .env, node_modules, and build artifacts'}
                </span>
              </div>

              <button
                onClick={handleSync}
                disabled={isSyncing || !selectedRepo.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-900/30 active:scale-95"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ar' ? 'جاري المزامنة والدفع...' : 'Syncing & Pushing...'}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'مزامنة ودفع إلى GitHub الآن' : 'Sync & Push to GitHub'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {syncError && (
              <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">{lang === 'ar' ? 'خطأ أثناء المزامنة:' : 'Sync Error:'}</p>
                  <p className="text-[11px] leading-relaxed text-red-200/90">{syncError}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {syncSuccess && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      {lang === 'ar'
                        ? `تمت المزامنة ودفع ${syncSuccess.syncedFilesCount} ملف بنجاح إلى ${syncSuccess.repo}!`
                        : `Successfully synced & pushed ${syncSuccess.syncedFilesCount} files to ${syncSuccess.repo}!`}
                    </span>
                  </div>

                  <a
                    href={syncSuccess.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-emerald-900/40 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-700/50 rounded-lg transition-colors"
                  >
                    <span>{lang === 'ar' ? 'عرض الـ Commit على GitHub' : 'View Commit on GitHub'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-gray-300 pt-2 border-t border-emerald-900/40 font-mono">
                  <div>
                    <span className="text-gray-500 block">Branch:</span>
                    <span className="text-purple-300">{syncSuccess.branch}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Commit SHA:</span>
                    <span className="text-emerald-400">{syncSuccess.commitSha.substring(0, 7)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Time:</span>
                    <span className="text-gray-400">{new Date(syncSuccess.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Synced files list collapsible */}
                <div className="pt-1">
                  <button
                    onClick={() => setShowFilesList(!showFilesList)}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <span>{lang === 'ar' ? 'عرض الملفات التي تمت مزامنتها' : 'View synced files'} ({syncSuccess.files.length})</span>
                    {showFilesList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showFilesList && (
                    <div className="mt-2 max-h-40 overflow-y-auto bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-[10px] font-mono text-gray-300 space-y-1">
                      {syncSuccess.files.map((file, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <FileCode className="w-3 h-3 text-indigo-400" />
                          <span>{file}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Repositories Cards */}
          {repos.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                {lang === 'ar' ? 'المستودعات المرتبطة بحسابك' : 'Your GitHub Repositories'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {repos.slice(0, 6).map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => handleRepoChange(repo.full_name)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selectedRepo === repo.full_name
                        ? 'bg-purple-950/20 border-purple-500 shadow-sm'
                        : 'bg-[#161b22] border-[#30363d] hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-xs text-white truncate max-w-[180px]">
                        {repo.name}
                      </span>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        {repo.private ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        {repo.default_branch}
                      </span>
                    </div>
                    {repo.description && (
                      <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-[#30363d]">
                      <span>{new Date(repo.updated_at).toLocaleDateString()}</span>
                      <span className="text-purple-400 font-semibold hover:underline">
                        {selectedRepo === repo.full_name
                          ? (lang === 'ar' ? 'محدد للمزامنة ✓' : 'Selected ✓')
                          : (lang === 'ar' ? 'تحديد' : 'Select')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
