import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CommandCenterView } from './components/CommandCenterView';
import { ProjectDevelopmentWorkspace } from './components/workspace/ProjectDevelopmentWorkspace';
import { HealthModal } from './components/HealthModal';
import {
  SystemHealthData,
  UserRole,
  AgentTask,
  ChatMessage,
  Project,
  FileNode,
  FileDiffResult,
  ProposedFileChange,
  TerminalEntry,
  AuditLog,
} from './types';
import { Language } from './lib/i18n';
import {
  fetchHealth,
  fetchDb,
  fetchFileTree,
  readFile,
  writeFile,
  undoFile,
  createFileOrDir,
  deleteFileOrDir,
  computeDiff,
  executeTerminalCommand,
  runAgentCycle,
  applyTask,
  rejectTask,
  sendChatMessage,
  updateUserRole,
  fetchSession,
  login,
} from './lib/api';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [currentView, setCurrentView] = useState<'home' | 'workspace'>('home');
  const [currentRole, setCurrentRole] = useState<UserRole>('Owner');
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // DB Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [currentTask, setCurrentTask] = useState<AgentTask | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Files
  const [tree, setTree] = useState<FileNode[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [originalFileContent, setOriginalFileContent] = useState<string>('');
  const [fileStatus, setFileStatus] = useState<'saved' | 'modified' | 'error'>('saved');
  const [isSaving, setIsSaving] = useState(false);

  // Diff
  const [activeDiff, setActiveDiff] = useState<FileDiffResult | null>(null);
  const [activeChange, setActiveChange] = useState<ProposedFileChange | null>(null);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);

  // Initial load
  const loadInitialData = async () => {
    try {
      const [hData, dbData, treeData] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchDb().catch(() => null),
        fetchFileTree().catch(() => []),
      ]);

      if (hData) setHealth(hData);
      if (dbData) {
        setProjects(dbData.projects || []);
        setActiveProject(dbData.projects?.[0] || null);
        setTasks(dbData.tasks || []);
        if (dbData.tasks?.length > 0) setCurrentTask(dbData.tasks[0]);
        setCurrentRole(dbData.currentUser?.role || 'Owner');
        setMessages(dbData.conversations?.[0]?.messages || []);
        setTerminalHistory(dbData.terminalHistory || []);
        setAuditLogs(dbData.auditLogs || []);
      }
      setTree(treeData);

      // Select default file if available
      if (!activeFilePath && treeData.length > 0) {
        const first = findFirstFile(treeData);
        if (first) {
          handleSelectFile(first);
        }
      }
    } catch (err) {
      console.error('Initial data load error:', err);
    }
  };

  useEffect(() => {
    (async () => {
      const session = await fetchSession();
      if (!session.authenticated) {
        setAuthenticated(false);
        return;
      }
      setAuthenticated(true);
      await loadInitialData();
    })();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const user = await login(loginEmail, loginPassword);
      setCurrentRole(user.role || 'Viewer');
      setAuthenticated(true);
      setLoginPassword('');
      await loadInitialData();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  if (authenticated === null) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><div className="animate-pulse">FORGEX AI</div></div>;
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-7 space-y-4">
          <div><h1 className="text-2xl font-bold">FORGEX AI</h1><p className="text-sm text-white/60 mt-1">Secure workspace sign in</p></div>
          <input required type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none" />
          <input required type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none" />
          {loginError && <div className="text-sm text-red-400">{loginError}</div>}
          <button type="submit" className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 px-4 py-3 font-semibold">Sign in</button>
        </form>
      </div>
    );
  }

  const findFirstFile = (nodes: FileNode[]): string | null => {
    for (const n of nodes) {
      if (n.type === 'file') return n.path;
      if (n.children) {
        const child = findFirstFile(n.children);
        if (child) return child;
      }
    }
    return null;
  };

  // Switch role
  const handleRoleChange = async (role: UserRole) => {
    setCurrentRole(role);
    try {
      await updateUserRole(role);
      const db = await fetchDb();
      setAuditLogs(db.auditLogs);
    } catch (e) {
      console.error(e);
    }
  };

  // File Handlers
  const handleSelectFile = async (filePath: string) => {
    try {
      const res = await readFile(filePath);
      setActiveFilePath(res.relPath);
      setFileContent(res.content);
      setOriginalFileContent(res.content);
      setFileStatus('saved');
    } catch (err) {
      console.error(err);
      setFileStatus('error');
    }
  };

  const handleContentChange = (newVal: string) => {
    setFileContent(newVal);
    setFileStatus(newVal === originalFileContent ? 'saved' : 'modified');
  };

  const handleSaveFile = async () => {
    if (!activeFilePath) return;
    setIsSaving(true);
    try {
      await writeFile(activeFilePath, fileContent);
      setOriginalFileContent(fileContent);
      setFileStatus('saved');
      // refresh tree & logs
      const [t, db] = await Promise.all([fetchFileTree(), fetchDb()]);
      setTree(t);
      setAuditLogs(db.auditLogs);
    } catch (err: any) {
      alert(`Save Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndoFile = async () => {
    if (!activeFilePath) return;
    try {
      const restored = await undoFile(activeFilePath);
      setFileContent(restored);
      setOriginalFileContent(restored);
      setFileStatus('saved');
      const db = await fetchDb();
      setAuditLogs(db.auditLogs);
    } catch (err: any) {
      alert(`Undo Error: ${err.message}`);
    }
  };

  const handleCreateItem = async (path: string, isDirectory: boolean) => {
    try {
      await createFileOrDir(path, isDirectory);
      const t = await fetchFileTree();
      setTree(t);
      if (!isDirectory) handleSelectFile(path);
    } catch (err: any) {
      alert(`Create Error: ${err.message}`);
    }
  };

  const handleDeleteItem = async (path: string) => {
    if (!confirm(`Are you sure you want to delete "${path}"?`)) return;
    try {
      await deleteFileOrDir(path);
      const t = await fetchFileTree();
      setTree(t);
      if (activeFilePath === path) {
        setActiveFilePath(null);
        setFileContent('');
      }
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  // Inspect Diff for proposed change
  const handleInspectDiff = async (change: ProposedFileChange) => {
    setActiveChange(change);
    try {
      const diff = await computeDiff(change.originalContent, change.newContent, change.filePath);
      setActiveDiff(diff);
    } catch (err) {
      console.error(err);
    }
  };

  // Autonomous cycle submit
  const handleSubmitPrompt = async (
    prompt: string,
    agent: string,
    targetFiles: string[] = []
  ) => {
    setIsProcessing(true);
    // Smoothly jump into workspace
    setCurrentView('workspace');

    // Add user message to conversation immediately
    try {
      const msg = await sendChatMessage(prompt, agent);
      setMessages((prev) => [...prev, msg]);

      // Run real cycle
      const task = await runAgentCycle({
        userRequest: prompt,
        assignedAgent: agent,
        targetFiles,
      });

      setCurrentTask(task);
      setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);

      // Add assistant response
      const reply = await sendChatMessage(
        `اكتمل تخطيط المهمة [${task.title}]. تم تجهيز ${task.proposedChanges?.length || 0} تعديل مقترح للفحص والموافقة.`,
        agent
      );
      setMessages((prev) => [...prev, reply]);

      if (task.proposedChanges?.[0]) {
        handleInspectDiff(task.proposedChanges[0]);
      }
    } catch (err: any) {
      alert(`Agent execution error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply Task Changes
  const handleApplyTask = async (taskId: string) => {
    setIsProcessing(true);
    try {
      const updated = await applyTask(taskId);
      setCurrentTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));

      // reload tree & DB
      const [newTree, db] = await Promise.all([fetchFileTree(), fetchDb()]);
      setTree(newTree);
      setAuditLogs(db.auditLogs);

      if (activeFilePath) {
        handleSelectFile(activeFilePath);
      }
    } catch (err: any) {
      alert(`Failed to apply changes: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject Task Changes
  const handleRejectTask = async (taskId: string) => {
    setIsProcessing(true);
    try {
      const updated = await rejectTask(taskId);
      setCurrentTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err: any) {
      alert(`Failed to reject: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Send message in chat
  const handleSendMessage = async (content: string, agent: string) => {
    setIsProcessing(true);
    try {
      const msg = await sendChatMessage(content, agent);
      setMessages((prev) => [...prev, msg]);

      // Trigger cycle
      const task = await runAgentCycle({
        userRequest: content,
        assignedAgent: agent,
      });
      setCurrentTask(task);
      setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);

      const reply = await sendChatMessage(
        `تمت معالجة التوجيه. الحالة: ${task.state}. عدد التعديلات: ${task.proposedChanges?.length || 0}`,
        agent
      );
      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      alert(`Chat error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Terminal Runner
  const handleExecuteCommand = async (cmd: string) => {
    setIsTerminalRunning(true);
    try {
      const entry = await executeTerminalCommand(cmd);
      setTerminalHistory((prev) => [entry, ...prev]);
      const db = await fetchDb();
      setAuditLogs(db.auditLogs);
    } catch (err: any) {
      alert(`Terminal Error: ${err.message}`);
    } finally {
      setIsTerminalRunning(false);
    }
  };

  const isRtl = lang === 'ar';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0d1117] text-gray-100 flex flex-col font-sans"
    >
      {/* Universal Top Header */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        health={health}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        lang={lang}
        onLangChange={setLang}
        onOpenHealthModal={() => setIsHealthModalOpen(true)}
      />

      {/* Main View Router */}
      {currentView === 'home' ? (
        <CommandCenterView
          lang={lang}
          tasks={tasks}
          projects={projects}
          activeProject={activeProject}
          onSelectProject={setActiveProject}
          onSubmitPrompt={handleSubmitPrompt}
          onOpenTask={(task) => {
            setCurrentTask(task);
            setCurrentView('workspace');
          }}
          onGoToWorkspace={() => setCurrentView('workspace')}
          isSubmitting={isProcessing}
        />
      ) : (
        <ProjectDevelopmentWorkspace
          lang={lang}
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          currentTask={currentTask}
          tasks={tasks}
          onSelectTask={setCurrentTask}
          onApplyTask={handleApplyTask}
          onRejectTask={handleRejectTask}
          onSendMessage={handleSendMessage}
          messages={messages}
          isProcessing={isProcessing}
          tree={tree}
          onSelectFile={handleSelectFile}
          activeFilePath={activeFilePath}
          fileContent={fileContent}
          onContentChange={handleContentChange}
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
          onExecuteCommand={handleExecuteCommand}
          isTerminalRunning={isTerminalRunning}
          auditLogs={auditLogs}
        />
      )}

      {/* Diagnostics / Health Modal */}
      <HealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        health={health}
        onRefreshHealth={async () => {
          const h = await fetchHealth();
          setHealth(h);
        }}
        lang={lang}
      />
    </div>
  );
}
