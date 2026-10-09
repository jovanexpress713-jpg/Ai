import React, { useState } from 'react';
import {
  Bot,
  FileCode,
  FileDiff,
  Terminal,
  ShieldCheck,
  Eye,
  GitBranch,
  ListOrdered,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AgentTask,
  ChatMessage,
  FileNode,
  FileDiffResult,
  ProposedFileChange,
  TerminalEntry,
  AuditLog,
  UserRole,
} from '../../types';
import { translations, Language } from '../../lib/i18n';
import { OrchestratorPanel } from './OrchestratorPanel';
import { FileManagerPanel } from './FileManagerPanel';
import { DiffViewerPanel } from './DiffViewerPanel';
import { TerminalPanel } from './TerminalPanel';
import { VerificationPanel } from './VerificationPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import { GitHubPanel } from './GitHubPanel';
import { SecurityAuditPanel } from './SecurityAuditPanel';

export type WorkspaceTab =
  | 'chat'
  | 'files'
  | 'diff'
  | 'terminal'
  | 'verify'
  | 'preview'
  | 'github'
  | 'logs'
  | 'security';

interface ProjectDevelopmentWorkspaceProps {
  lang: Language;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  // Tasks & cycle
  currentTask: AgentTask | null;
  tasks: AgentTask[];
  onSelectTask: (task: AgentTask) => void;
  onApplyTask: (taskId: string) => void;
  onRejectTask: (taskId: string) => void;
  onSendMessage: (content: string, agent: string) => void;
  messages: ChatMessage[];
  isProcessing: boolean;
  // Files
  tree: FileNode[];
  onSelectFile: (path: string) => void;
  activeFilePath: string | null;
  fileContent: string;
  onContentChange: (content: string) => void;
  onSaveFile: () => void;
  onUndoFile: () => void;
  onCreateItem: (path: string, isDirectory: boolean) => void;
  onDeleteItem: (path: string) => void;
  fileStatus: 'saved' | 'modified' | 'error';
  isSaving: boolean;
  // Diff
  activeDiff: FileDiffResult | null;
  activeChange: ProposedFileChange | null;
  onInspectDiff: (change: ProposedFileChange) => void;
  // Terminal
  terminalHistory: TerminalEntry[];
  onExecuteCommand: (cmd: string) => void;
  isTerminalRunning: boolean;
  // Audit Logs
  auditLogs: AuditLog[];
}

export const ProjectDevelopmentWorkspace: React.FC<ProjectDevelopmentWorkspaceProps> = ({
  lang,
  currentRole,
  onRoleChange,
  currentTask,
  tasks,
  onSelectTask,
  onApplyTask,
  onRejectTask,
  onSendMessage,
  messages,
  isProcessing,
  tree,
  onSelectFile,
  activeFilePath,
  fileContent,
  onContentChange,
  onSaveFile,
  onUndoFile,
  onCreateItem,
  onDeleteItem,
  fileStatus,
  isSaving,
  activeDiff,
  activeChange,
  onInspectDiff,
  terminalHistory,
  onExecuteCommand,
  isTerminalRunning,
  auditLogs,
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chat');

  const canEdit = ['Owner', 'Admin', 'Developer'].includes(currentRole);
  const canExec = ['Owner', 'Admin'].includes(currentRole);

  const tabs = [
    { id: 'chat', icon: Bot, labelAr: 'الوكيل والمحادثة', labelEn: 'Agent & Chat' },
    { id: 'files', icon: FileCode, labelAr: 'الملفات والكود', labelEn: 'Files & Editor' },
    { id: 'diff', icon: FileDiff, labelAr: 'فاحص الفروقات', labelEn: 'Diff Inspector' },
    { id: 'terminal', icon: Terminal, labelAr: 'سطر الأوامر', labelEn: 'Terminal' },
    { id: 'verify', icon: ShieldCheck, labelAr: 'التحقق والاختبار', labelEn: 'Verification' },
    { id: 'preview', icon: Eye, labelAr: 'المعاينة الحية', labelEn: 'Preview' },
    { id: 'github', icon: GitBranch, labelAr: 'مزامنة GitHub', labelEn: 'GitHub' },
    { id: 'security', icon: Lock, labelAr: 'الأمان و RBAC', labelEn: 'Security & RBAC' },
  ];

  return (
    <div className="h-[calc(100vh-50px)] flex flex-col md:flex-row bg-[#0d1117] text-gray-200 overflow-hidden">
      {/* Left/Sidebar Navigation (Mobile horizontal bar, Desktop vertical bar) */}
      <nav className="w-full md:w-56 bg-[#161b22] border-b md:border-b-0 md:border-r border-[#30363d] flex md:flex-col justify-start overflow-x-auto md:overflow-x-visible md:overflow-y-auto p-2 gap-1 shrink-0 select-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WorkspaceTab)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800 shadow-sm'
                  : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-gray-400'}`} />
              <span className="hidden md:inline">{lang === 'ar' ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Panel View */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
        {activeTab === 'chat' && (
          <OrchestratorPanel
            lang={lang}
            currentTask={currentTask}
            tasks={tasks}
            messages={messages}
            onSelectTask={onSelectTask}
            onApplyTask={onApplyTask}
            onRejectTask={onRejectTask}
            onSendMessage={onSendMessage}
            onInspectDiff={(change) => {
              onInspectDiff(change);
              setActiveTab('diff');
            }}
            currentRole={currentRole}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'files' && (
          <FileManagerPanel
            lang={lang}
            tree={tree}
            onSelectFile={onSelectFile}
            activeFilePath={activeFilePath}
            fileContent={fileContent}
            onContentChange={onContentChange}
            onSaveFile={onSaveFile}
            onUndoFile={onUndoFile}
            onCreateItem={onCreateItem}
            onDeleteItem={onDeleteItem}
            onInspectDiff={() => setActiveTab('diff')}
            fileStatus={fileStatus}
            isSaving={isSaving}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'diff' && (
          <DiffViewerPanel
            lang={lang}
            diff={activeDiff}
            activeChange={activeChange}
            onApply={
              currentTask && currentTask.state === 'WAITING_APPROVAL'
                ? () => onApplyTask(currentTask.id)
                : undefined
            }
            onReject={
              currentTask && currentTask.state === 'WAITING_APPROVAL'
                ? () => onRejectTask(currentTask.id)
                : undefined
            }
            onUndo={activeFilePath ? onUndoFile : undefined}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'terminal' && (
          <TerminalPanel
            lang={lang}
            history={terminalHistory}
            onExecuteCommand={onExecuteCommand}
            isRunning={isTerminalRunning}
            canExecute={canExec}
          />
        )}

        {activeTab === 'verify' && <VerificationPanel lang={lang} />}

        {activeTab === 'preview' && <LivePreviewPanel lang={lang} />}

        {activeTab === 'github' && <GitHubPanel lang={lang} />}

        {activeTab === 'security' && (
          <SecurityAuditPanel
            lang={lang}
            currentRole={currentRole}
            onRoleChange={onRoleChange}
            auditLogs={auditLogs}
          />
        )}
      </main>
    </div>
  );
};
