import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Search,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  File,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { FileNode } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface FileManagerPanelProps {
  lang: Language;
  tree: FileNode[];
  onSelectFile: (path: string) => void;
  activeFilePath: string | null;
  fileContent: string;
  onContentChange: (content: string) => void;
  onSaveFile: () => void;
  onUndoFile: () => void;
  onCreateItem: (path: string, isDirectory: boolean) => void;
  onDeleteItem: (path: string) => void;
  onInspectDiff: (filePath: string, original: string, modified: string) => void;
  fileStatus: 'saved' | 'modified' | 'error';
  isSaving: boolean;
  canEdit: boolean;
}

export const FileManagerPanel: React.FC<FileManagerPanelProps> = ({
  lang,
  tree,
  onSelectFile,
  activeFilePath,
  fileContent,
  onContentChange,
  onSaveFile,
  onUndoFile,
  onCreateItem,
  onDeleteItem,
  onInspectDiff,
  fileStatus,
  isSaving,
  canEdit,
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    src: true,
    server: true,
  });
  const [newItemName, setNewItemName] = useState('');
  const [isCreatingDir, setIsCreatingDir] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    onCreateItem(newItemName.trim(), isCreatingDir);
    setNewItemName('');
    setShowCreateModal(false);
  };

  const renderTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = !!expandedFolders[node.path];
      const isSelected = activeFilePath === node.path;
      const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (node.type === 'directory') {
        return (
          <div key={node.path} className="select-none">
            <div
              onClick={() => toggleFolder(node.path)}
              style={{ paddingInlineStart: `${level * 14 + 8}px` }}
              className="flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-[#21262d] cursor-pointer text-xs text-gray-300 font-medium group transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-cyan-500" />
              )}
              <span className="truncate group-hover:text-white">{node.name}</span>
            </div>

            {isExpanded && node.children && (
              <div>{renderTree(node.children, level + 1)}</div>
            )}
          </div>
        );
      }

      if (!matchesSearch) return null;

      return (
        <div
          key={node.path}
          onClick={() => onSelectFile(node.path)}
          style={{ paddingInlineStart: `${level * 14 + 20}px` }}
          className={`flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer text-xs font-mono transition-colors group ${
            isSelected
              ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/80 font-bold'
              : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {node.name.endsWith('.tsx') || node.name.endsWith('.ts') ? (
              <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            ) : node.name.endsWith('.json') ? (
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          {node.size !== undefined && (
            <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
              {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}k` : `${node.size}b`}
            </span>
          )}
        </div>
      );
    });
  };

  const lineCount = fileContent.split('\n').length;

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#0d1117] text-gray-200 overflow-hidden">
      {/* Left Tree Explorer (260px) */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#30363d] bg-[#161b22] flex flex-col shrink-0">
        {/* Explorer Header */}
        <div className="p-3 border-b border-[#30363d] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
            {t.files.title}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setIsCreatingDir(false);
                setShowCreateModal(true);
              }}
              className="p-1 rounded hover:bg-[#21262d] text-gray-400 hover:text-cyan-400 transition-colors"
              title={t.files.createFile}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsCreatingDir(true);
                setShowCreateModal(true);
              }}
              className="p-1 rounded hover:bg-[#21262d] text-gray-400 hover:text-cyan-400 transition-colors"
              title={t.files.createFolder}
            >
              <Folder className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-[#21262d]">
          <div className="relative">
            <Search className="w-3 h-3 text-gray-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.files.search}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md py-1 px-2 pl-7 text-[11px] text-gray-200 placeholder-gray-500 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {renderTree(tree)}
        </div>
      </div>

      {/* Right File Editor */}
      <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
        {activeFilePath ? (
          <>
            {/* Editor Action Bar */}
            <div className="p-2.5 px-4 bg-[#161b22] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="font-mono font-bold text-gray-200">{activeFilePath}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                    fileStatus === 'saved'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : fileStatus === 'modified'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {fileStatus === 'saved' ? t.files.saved : t.files.modified}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onUndoFile}
                  disabled={!canEdit}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-gray-300 text-xs transition-colors"
                  title="Undo to previous version from disk backup"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.files.undo}</span>
                </button>

                <button
                  onClick={onSaveFile}
                  disabled={!canEdit || isSaving || fileStatus === 'saved'}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : t.files.save}</span>
                </button>

                <button
                  onClick={() => onDeleteItem(activeFilePath)}
                  disabled={!canEdit}
                  className="p-1 rounded bg-[#21262d] hover:bg-red-950 hover:text-red-400 text-gray-400 transition-colors"
                  title={t.files.delete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Code Text Area with Line numbers */}
            <div className="flex-1 flex overflow-hidden font-mono text-xs">
              {/* Line numbers gutter */}
              <div className="w-12 bg-[#0d1117] border-r border-[#21262d] py-3 text-right pr-2 text-gray-600 select-none overflow-hidden shrink-0">
                {Array.from({ length: Math.max(lineCount, 30) }).map((_, i) => (
                  <div key={i} className="leading-5 h-5">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Text editor area */}
              <textarea
                value={fileContent}
                onChange={(e) => onContentChange(e.target.value)}
                disabled={!canEdit}
                spellCheck={false}
                className="flex-1 bg-[#0d1117] p-3 text-gray-200 leading-5 outline-none resize-none font-mono text-xs overflow-auto whitespace-pre selection:bg-cyan-900 selection:text-white"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-2">
            <FileCode className="w-10 h-10 text-gray-600" />
            <p className="text-xs">
              {lang === 'ar' ? 'حدد ملفاً من القائمة الجانبية للعرض والتعديل' : 'Select a file from tree to view and edit'}
            </p>
          </div>
        )}
      </div>

      {/* Create item Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-white">
              {isCreatingDir ? t.files.createFolder : t.files.createFile}
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={isCreatingDir ? 'e.g. src/utils' : 'e.g. src/example.ts'}
                autoFocus
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500 font-mono"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#21262d] text-gray-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
