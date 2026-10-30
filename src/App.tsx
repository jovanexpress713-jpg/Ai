import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { WorkspaceSidebar, type WorkspaceSection } from './components/shell/WorkspaceSidebar';
import { CreativeStudioView } from './components/creative/CreativeStudioView';
import { HealthModal } from './components/HealthModal';
import { CommandCenterView } from './components/CommandCenterView';
import { ProjectDevelopmentWorkspace } from './components/workspace/ProjectDevelopmentWorkspace';
import { LivePreviewPanel } from './components/workspace/LivePreviewPanel';
import {
  Sparkles,
  Send,
  Paperclip,
  Monitor,
  Smartphone,
  Tablet,
  Code,
  Eye,
  CheckCircle2,
  Wand2,
  Palette,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import {
  SystemHealthData,
  UserRole,
  AgentTask,
  Project,
  FileNode,
  FileDiffResult,
  ProposedFileChange,
  TerminalEntry,
  AuditLog,
  ChatMessage,
  DbData,
} from './types';
import { Language } from './lib/i18n';
import {
  fetchSession,
  fetchHealth,
  fetchFileTree,
  readFile,
  writeFile,
  createFileOrDir,
  deleteFileOrDir,
  undoFile,
  computeDiff,
  executeTerminalCommand,
  fetchDb,
  runAgentCycle,
  applyTaskChanges,
  rejectTaskChanges,
  updateUserRole,
} from './lib/api';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [currentView, setCurrentView] = useState<'studio' | 'home' | 'workspace' | 'creative' | 'comingSoon'>('studio');
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('studio');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('Owner');
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // Studio Mode State
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showCode, setShowCode] = useState(false);
  const [studioPrompt, setStudioPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [activePalette, setActivePalette] = useState<'indigo' | 'emerald' | 'cyan' | 'purple'>('indigo');
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const [previewKey, setPreviewKey] = useState(1);
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string>('');
  const [studioMessages, setStudioMessages] = useState<Array<{
    sender: 'user' | 'agent';
    text: string;
    status: 'success' | 'error' | null;
    timestamp?: string;
  }>>([
    {
      sender: 'agent',
      text: 'مرحباً بك في FORGEX AI. أرسل طلبك إلى محرك الهندسة، ثم راجع المقترحات ونتائج التحقق في مساحة العمل قبل اعتماد أي تغيير.',
      status: null,
      timestamp: 'الآن',
    },
  ]);
  const [isStudioProcessing, setIsStudioProcessing] = useState(false);

  // Workspace & DB State
  const [dbData, setDbData] = useState<DbData | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [currentTask, setCurrentTask] = useState<AgentTask | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileStatus, setFileStatus] = useState<'saved' | 'modified' | 'error'>('saved');
  const [isSaving, setIsSaving] = useState(false);
  const [activeDiff, setActiveDiff] = useState<FileDiffResult | null>(null);
  const [activeChange, setActiveChange] = useState<ProposedFileChange | null>(null);
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([]);
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [workspaceMessages, setWorkspaceMessages] = useState<ChatMessage[]>([]);
  const [isWorkspaceProcessing, setIsWorkspaceProcessing] = useState(false);

  const quickPrompts = [
    'أضف لوحة إحصائيات عصرية مع رسوم بيانية تفاعلية',
    'تطبيق نظام ألوان داكن فخم مع تدرجات متناسقة',
    'تصميم شريط تنقل متجاوب مع دعم الهواتف المحمولة',
  ];

  // Refresh System Health
  const loadHealth = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (err) {
      console.warn('Failed to load health:', err);
    }
  }, []);

  // Refresh Persistent DB & Workspace Tree
  const loadDbAndFiles = useCallback(async () => {
    try {
      const [db, fileTree] = await Promise.allSettled([fetchDb(), fetchFileTree()]);
      if (db.status === 'fulfilled') {
        setDbData(db.value);
        setTasks(db.value.tasks || []);
        if (db.value.tasks?.length > 0 && !currentTask) {
          setCurrentTask(db.value.tasks[0]);
        }
        setProjects(db.value.projects || []);
        if (db.value.projects?.length > 0 && !activeProject) {
          const current = db.value.projects.find((p) => p.isCurrent) || db.value.projects[0];
          setActiveProject(current);
        }
        setTerminalHistory(db.value.terminalHistory || []);
        setAuditLogs(db.value.auditLogs || []);
        if (db.value.currentUser?.role) {
          setCurrentRole(db.value.currentUser.role);
        }
        if (db.value.conversations?.[0]?.messages) {
          setWorkspaceMessages(db.value.conversations[0].messages);
        }
      }
      if (fileTree.status === 'fulfilled') {
        setTree(fileTree.value);
      }
    } catch (err) {
      console.warn('Failed to load DB or file tree:', err);
    }
  }, [currentTask, activeProject]);

  useEffect(() => {
    fetchSession().catch(() => {});
    loadHealth();
    loadDbAndFiles();
  }, [loadHealth, loadDbAndFiles]);

  // Handle Role Change
  const handleRoleChange = async (newRole: UserRole) => {
    try {
      await updateUserRole(newRole);
      setCurrentRole(newRole);
      loadDbAndFiles();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  // Studio Mode: Process Prompt
  const handleSendStudio = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? studioPrompt).trim();
    if (!textToSend || isStudioProcessing) return;

    setStudioMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: textToSend,
        status: null,
        timestamp: new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    setStudioPrompt('');
    setIsStudioProcessing(true);

    try {
      const res = await fetch('/api/agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSend }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
      }

      setStudioMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: data.message || (lang === 'ar' ? 'تمت معالجة الطلب. راجع المقترح في مساحة العمل قبل تطبيقه.' : 'Request processed. Review the proposed changes in the workspace before applying them.'),
          status: null,
          timestamp: new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        } as const,
      ]);
    } catch (err: any) {
      setStudioMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: lang === 'ar'
            ? `تعذر تنفيذ الطلب: ${err?.message || 'حدث خطأ غير معروف'}. لم يتم تأكيد أي تعديل.`
            : `Request failed: ${err?.message || 'Unknown error'}. No changes were confirmed.`,
          status: 'error',
          timestamp: new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        } as const,
      ]);
    } finally {
      setIsStudioProcessing(false);
    }
  };

  // Studio Mode: Export Code
  const handleExport = () => {
    const sampleCode = `// ForgeX Studio - Exported Component
export default function AppRender() {
  return (
    <div className="p-8 bg-slate-900 text-slate-100 min-h-screen flex flex-col justify-center items-center text-center">
      <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/40 rounded-2xl flex items-center justify-center mb-4 text-indigo-400 text-2xl font-bold shadow-lg">
        FX
      </div>
      <h2 className="text-2xl font-bold mb-2">ForgeX AI Production Build</h2>
      <p className="text-slate-400 max-w-md text-sm leading-relaxed">
        ${lastGeneratedPrompt ? `Generated prompt: "${lastGeneratedPrompt}"` : 'Modern UI/UX Responsive Canvas Application'}
      </p>
    </div>
  );
}`;
    navigator.clipboard.writeText(sampleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // File Operations in Workspace
  const handleSelectFile = async (filePath: string) => {
    try {
      const fileData = await readFile(filePath);
      setActiveFilePath(filePath);
      setFileContent(fileData.content);
      setFileStatus('saved');
    } catch (err: any) {
      alert(`Could not open file: ${err.message}`);
    }
  };

  const handleSaveFile = async () => {
    if (!activeFilePath) return;
    setIsSaving(true);
    try {
      await writeFile(activeFilePath, fileContent);
      setFileStatus('saved');
      loadDbAndFiles();
    } catch (err: any) {
      setFileStatus('error');
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndoFile = async () => {
    if (!activeFilePath) return;
    try {
      const restored = await undoFile(activeFilePath);
      setFileContent(restored);
      setFileStatus('saved');
      loadDbAndFiles();
    } catch (err: any) {
      alert(err.message || 'Undo not available');
    }
  };

  const handleCreateItem = async (path: string, isDirectory: boolean) => {
    try {
      await createFileOrDir(path, isDirectory, '');
      await loadDbAndFiles();
      if (!isDirectory) {
        handleSelectFile(path);
      }
    } catch (err: any) {
      alert(`Failed to create item: ${err.message}`);
    }
  };

  const handleDeleteItem = async (path: string) => {
    if (!confirm(lang === 'ar' ? `هل أنت متأكد من حذف ${path}؟` : `Delete ${path}?`)) return;
    try {
      await deleteFileOrDir(path);
      if (activeFilePath === path) {
        setActiveFilePath(null);
        setFileContent('');
      }
      loadDbAndFiles();
    } catch (err: any) {
      alert(`Failed to delete item: ${err.message}`);
    }
  };

  // Terminal Execution
  const handleExecuteTerminal = async (command: string) => {
    setIsTerminalRunning(true);
    try {
      const entry = await executeTerminalCommand(command);
      setTerminalHistory((prev) => [entry, ...prev]);
      loadDbAndFiles();
    } catch (err: any) {
      alert(err.message || 'Command rejected');
    } finally {
      setIsTerminalRunning(false);
    }
  };

  // Agent Autonomous Cycle (from Command Center or Workspace)
  const handleRunAgentCycle = async (userRequest: string, assignedAgent = 'Planner', targetFiles?: string[]) => {
    setIsWorkspaceProcessing(true);
    try {
      const task = await runAgentCycle({
        userRequest,
        assignedAgent,
        targetFiles,
        autoApplyIfVerified: false,
      });
      setCurrentTask(task);
      setTasks((prev) => [task, ...prev]);
      setCurrentView('workspace');
      loadDbAndFiles();
    } catch (err: any) {
      alert(`Cycle failed: ${err.message}`);
    } finally {
      setIsWorkspaceProcessing(false);
    }
  };

  const handleApplyTask = async (taskId: string) => {
    try {
      const updated = await applyTaskChanges(taskId);
      setCurrentTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      loadDbAndFiles();
      alert(lang === 'ar' ? 'تم تطبيق التعديلات بنجاح على مساحة العمل!' : 'Changes applied to workspace successfully!');
    } catch (err: any) {
      alert(`Apply failed: ${err.message}`);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      const updated = await rejectTaskChanges(taskId);
      setCurrentTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      loadDbAndFiles();
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    }
  };

  const handleInspectDiff = async (change: ProposedFileChange) => {
    setActiveChange(change);
    try {
      const diffResult = await computeDiff(change.originalContent, change.newContent, change.filePath);
      setActiveDiff(diffResult);
    } catch (err: any) {
      alert(`Diff calculation failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-slate-100 font-sans overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Universal Header */}
      <Header
        currentView={currentView === 'creative' || currentView === 'comingSoon' ? 'studio' : currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          setActiveSection(view);
        }}
        health={health}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        lang={lang}
        onLangChange={setLang}
        onOpenHealthModal={() => setIsHealthModalOpen(true)}
      />

      {/* Premium workspace navigation */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <WorkspaceSidebar
          active={activeSection}
          lang={lang}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          onNavigate={(section) => {
            setActiveSection(section);
            if (section === 'home' || section === 'studio' || section === 'workspace' || section === 'creative') {
              setCurrentView(section);
            } else {
              setCurrentView('comingSoon');
            }
          }}
        />

      {/* Main Content View Switcher */}
      <div className="flex-1 flex overflow-hidden">
        {/* VIEW 1: STUDIO CANVAS */}
        {currentView === 'studio' && (
          <div className="flex-1 flex overflow-hidden">
            {/* AI Studio Chat Panel */}
            <div className="w-1/2 flex flex-col border-l border-slate-800 bg-slate-900/60 backdrop-blur-md">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600/20 rounded-xl text-indigo-400 border border-indigo-500/30 shadow-inner">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="font-bold text-base text-slate-100 flex items-center gap-2">
                      <span>ForgeX AI Studio</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        v2.4
                      </span>
                    </h1>
                    <p className="text-xs text-slate-400">
                      {lang === 'ar'
                        ? 'محرك التصميم والتطوير المباشر المعزز بالذكاء الاصطناعي'
                        : 'AI-assisted Live Design & Engineering Engine'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-slate-300 shadow-sm">
                    <span className="font-medium text-slate-300">{lang === 'ar' ? 'مساحة العمل' : 'Workspace'}</span>
                  </div>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {studioMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-4 text-sm leading-relaxed transition-all ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-600/15'
                          : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none shadow-md'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      {msg.status === 'success' && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2 text-xs text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>
                            {lang === 'ar'
                              ? 'تم إجراء التحديث والتحقق من سلامة الأكواد تلقائياً'
                              : 'Update applied and code verified automatically'}
                          </span>
                        </div>
                      )}
                      {msg.status === 'error' && (
                        <div className="mt-3 pt-3 border-t border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
                          <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                          <span>{lang === 'ar' ? 'تعذر التنفيذ — لم يتم تأكيد أي تغيير.' : 'Execution failed — no changes were confirmed.'}</span>
                        </div>
                      )}
                      {msg.timestamp && (
                        <div className="text-[10px] text-slate-400/80 mt-1.5 text-left" dir="ltr">
                          {msg.timestamp}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isStudioProcessing && (
                  <div className="flex items-center gap-3 p-4 bg-slate-800/40 border border-slate-700/40 rounded-2xl max-w-[85%] animate-pulse">
                    <Wand2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="font-medium text-indigo-300">
                        {lang === 'ar' ? 'جاري معالجة الطلب وتطبيق المعايير البرمجية...' : 'Processing request and applying updates...'}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        {lang === 'ar' ? 'فحص الهيكلية وتحديث شاشات المعاينة الحية' : 'Validating structure and updating live canvas'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Suggestions Bar */}
              <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
                <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                  {lang === 'ar' ? 'اقتراحات:' : 'Suggestions:'}
                </span>
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendStudio(qp)}
                    disabled={isStudioProcessing}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-slate-700/60 text-slate-300 hover:text-indigo-200 transition-colors text-[11px]"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
                <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-2.5 focus-within:border-indigo-500 transition-all shadow-inner">
                  <textarea
                    rows={2}
                    value={studioPrompt}
                    onChange={(e) => setStudioPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendStudio();
                      }
                    }}
                    placeholder={
                      lang === 'ar'
                        ? 'اكتب أمرك هنا (مثال: أضف لوحة التحكم واجعل الألوان متناسقة)...'
                        : 'Type your request here (e.g. Add dashboard and modern dark palette)...'
                    }
                    className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none px-2 py-1 leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                        title={lang === 'ar' ? 'إرفاق تصميم مرجعي' : 'Attach reference'}
                        onClick={() => {
                          setStudioPrompt((prev) =>
                            prev
                              ? `${prev} [مرفق تصميم مرجعي]`
                              : lang === 'ar'
                              ? 'تطبيق النموذج المرفق وتحديث التنسيق'
                              : 'Apply reference model'
                          );
                        }}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowPalettePicker(!showPalettePicker)}
                          className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title={lang === 'ar' ? 'نظام الألوان' : 'Color palette'}
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                        {showPalettePicker && (
                          <div className="absolute bottom-10 right-0 bg-slate-900 border border-slate-700 rounded-xl p-2.5 shadow-xl z-20 flex gap-2">
                            <button
                              onClick={() => {
                                setActivePalette('indigo');
                                setShowPalettePicker(false);
                              }}
                              className="w-6 h-6 rounded-full bg-indigo-600 ring-2 ring-indigo-400"
                              title="Indigo"
                            />
                            <button
                              onClick={() => {
                                setActivePalette('emerald');
                                setShowPalettePicker(false);
                              }}
                              className="w-6 h-6 rounded-full bg-emerald-600 ring-2 ring-emerald-400"
                              title="Emerald"
                            />
                            <button
                              onClick={() => {
                                setActivePalette('cyan');
                                setShowPalettePicker(false);
                              }}
                              className="w-6 h-6 rounded-full bg-cyan-600 ring-2 ring-cyan-400"
                              title="Cyan"
                            />
                            <button
                              onClick={() => {
                                setActivePalette('purple');
                                setShowPalettePicker(false);
                              }}
                              className="w-6 h-6 rounded-full bg-purple-600 ring-2 ring-purple-400"
                              title="Purple"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendStudio()}
                      disabled={!studioPrompt.trim() || isStudioProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                    >
                      <span>{lang === 'ar' ? 'تنفيذ' : 'Run'}</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Canvas Viewport */}
            <div className="w-1/2 flex flex-col bg-slate-950">
              <div className="h-14 border-b border-slate-800 bg-slate-900 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setViewMode('desktop')}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Desktop"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('tablet')}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Tablet"
                  >
                    <Tablet className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('mobile')}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Mobile"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCode(!showCode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      showCode
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {showCode ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                    <span>{showCode ? (lang === 'ar' ? 'المعاينة الحية' : 'Live Preview') : (lang === 'ar' ? 'كود المصدر' : 'Source Code')}</span>
                  </button>

                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-500 rounded-lg text-xs font-medium cursor-not-allowed"
                    title={lang === 'ar' ? 'تصدير ملفات المشروع الفعلية غير متاح في هذا العرض' : 'Exporting actual project files is not available in this view'}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                    <span>{lang === 'ar' ? 'التصدير غير متاح' : 'Export unavailable'}</span>
                  </button>
                </div>
              </div>

              {/* Canvas viewport container */}
              <div className="flex-1 p-6 flex items-center justify-center bg-slate-950 overflow-auto">
                <div
                  className={`transition-all duration-300 h-full w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col ${
                    viewMode === 'mobile'
                      ? 'max-w-[375px] h-[667px]'
                      : viewMode === 'tablet'
                      ? 'max-w-[768px] h-[900px]'
                      : 'w-full h-full'
                  }`}
                >
                  {showCode ? (
                    <div className="p-4 font-mono text-xs text-slate-300 bg-slate-900 h-full overflow-auto" dir="ltr">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-slate-500">
                        <span>// ForgeX AI Studio — Live Generated Component</span>
                        <button
                          type="button"
                          disabled
                          title={lang === 'ar' ? 'هذا عرض توضيحي وليس كود المشروع الفعلي' : 'Illustrative preview, not actual project source'}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-500 text-[11px] cursor-not-allowed"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'عرض توضيحي' : 'Preview only'}</span>
                        </button>
                      </div>
                      <pre className="text-indigo-300 leading-relaxed overflow-x-auto">
{`export default function AppRender() {
  return (
    <div className="p-8 bg-slate-900 text-slate-100 min-h-full flex flex-col justify-center items-center text-center">
      <div className="w-16 h-16 bg-${activePalette}-600/20 border border-${activePalette}-500/40 rounded-2xl flex items-center justify-center mb-4 text-${activePalette}-400 text-2xl font-bold">
        FX
      </div>
      <h2 className="text-2xl font-bold mb-2">
        ${lang === 'ar' ? 'المشروع جاهز ومُصمم بحسب المعايير العصرية' : 'Project is ready and engineered to modern specs'}
      </h2>
      <p className="text-slate-400 max-w-md text-sm leading-relaxed">
        ${lastGeneratedPrompt ? `${lang === 'ar' ? 'طلب المستخدم' : 'Prompt'}: "${lastGeneratedPrompt}"` : (lang === 'ar' ? 'تطبيق أنظمة التصميم المتقدمة وتجربة المستخدم السلسة.' : 'Modern UI/UX design systems applied.')}
      </p>
    </div>
  );
}`}
                      </pre>
                    </div>
                  ) : (
                    <div key={previewKey} className="w-full h-full">
                      <LivePreviewPanel lang={lang} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'creative' && <CreativeStudioView lang={lang} />}

        {currentView === 'comingSoon' && (
          <main className="forge-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="forge-page-kicker"><Sparkles size={14} /> FORGEX AI</div>
            <h1 className="forge-page-title">{lang === 'ar' ? 'هذه المساحة ضمن خارطة التطوير' : 'This workspace is on the delivery roadmap'}</h1>
            <p className="forge-page-subtitle">{lang === 'ar' ? 'لم يتم ربط هذه الوظيفة بعد. لن نعرض بيانات أو حالة تشغيل وهمية. ستظهر هنا عند اكتمال تنفيذها وربطها بالخدمات الحقيقية.' : 'This capability is not connected yet. We will not show fabricated data or runtime status. It will appear here when its real implementation and integrations are ready.'}</p>
            <div className="forge-unavailable-note">{lang === 'ar' ? 'الحالة: قيد التطوير — لا توجد عملية تشغيل متاحة حالياً.' : 'Status: In development — no runnable action is available yet.'}</div>
          </main>
        )}

        {/* VIEW 2: COMMAND CENTER */}
        {currentView === 'home' && (
          <CommandCenterView
            lang={lang}
            tasks={tasks}
            projects={projects}
            activeProject={activeProject}
            onSelectProject={(proj) => {
              setActiveProject(proj);
              loadDbAndFiles();
            }}
            onSubmitPrompt={(userPrompt, agent, targetFiles) => {
              handleRunAgentCycle(userPrompt, agent, targetFiles);
            }}
            onOpenTask={(task) => {
              setCurrentTask(task);
              setCurrentView('workspace');
            }}
            onGoToWorkspace={() => setCurrentView('workspace')}
            isSubmitting={isWorkspaceProcessing}
          />
        )}

        {/* VIEW 3: FULL IDE WORKSPACE */}
        {currentView === 'workspace' && (
          <ProjectDevelopmentWorkspace
            lang={lang}
            currentRole={currentRole}
            onRoleChange={handleRoleChange}
            currentTask={currentTask}
            tasks={tasks}
            onSelectTask={setCurrentTask}
            onApplyTask={handleApplyTask}
            onRejectTask={handleRejectTask}
            onSendMessage={(content, agent) => {
              handleRunAgentCycle(content, agent);
            }}
            messages={workspaceMessages}
            isProcessing={isWorkspaceProcessing}
            tree={tree}
            onSelectFile={handleSelectFile}
            activeFilePath={activeFilePath}
            fileContent={fileContent}
            onContentChange={(content) => {
              setFileContent(content);
              setFileStatus('modified');
            }}
            onSaveFile={handleSaveFile}
            onUndoFile={handleUndoFile}
            onCreateItem={handleCreateItem}
            onDeleteItem={handleDeleteItem}
            fileStatus={fileStatus}
            isSaving={isSaving}
            activeDiff={activeDiff}
            activeChange={activeChange}
            onInspectDiff={handleInspectDiff}
            terminalHistory={terminalHistory}
            onExecuteCommand={handleExecuteTerminal}
            isTerminalRunning={isTerminalRunning}
            auditLogs={auditLogs}
          />
        )}
      </div>
      </div>

      {/* Integration & Diagnostics Modal */}
      <HealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        health={health}
        onRefreshHealth={loadHealth}
        lang={lang}
      />
    </div>
  );
}
