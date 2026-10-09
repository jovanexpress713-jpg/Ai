import React from 'react';
import {
  FileDiff,
  Check,
  X,
  RotateCcw,
  Plus,
  Minus,
  FileCode,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { FileDiffResult, ProposedFileChange } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface DiffViewerPanelProps {
  lang: Language;
  diff: FileDiffResult | null;
  activeChange?: ProposedFileChange | null;
  onApply?: () => void;
  onReject?: () => void;
  onUndo?: () => void;
  isProcessing?: boolean;
}

export const DiffViewerPanel: React.FC<DiffViewerPanelProps> = ({
  lang,
  diff,
  activeChange,
  onApply,
  onReject,
  onUndo,
  isProcessing,
}) => {
  const t = translations[lang];

  if (!diff) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0d1117] text-gray-500 p-8 space-y-3">
        <FileDiff className="w-12 h-12 text-gray-600" />
        <h3 className="text-sm font-bold text-gray-300">
          {lang === 'ar' ? 'لا يوجد فحص فروقات نشط' : 'No Active Diff Selected'}
        </h3>
        <p className="text-xs text-gray-500 max-w-sm text-center">
          {lang === 'ar'
            ? 'انقر على "Diff" بجانب أي تعديل مقترح في تبويب الوكيل أو افتح ملفاً لمقارنته.'
            : 'Select "Diff" next to a proposed file change in the Agent panel or compare files.'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-hidden font-mono text-xs">
      {/* Diff Header Bar */}
      <div className="p-3 bg-[#161b22] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white text-sm">{diff.filePath}</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              +{diff.additions} {t.diff.additions}
            </span>
            <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              -{diff.deletions} {t.diff.deletions}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-amber-300 font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.diff.undo}</span>
            </button>
          )}

          {onReject && (
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold border border-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t.diff.reject}</span>
            </button>
          )}

          {onApply && (
            <button
              onClick={onApply}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-400 shadow-md shadow-emerald-950 transition-all hover:scale-105"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.diff.apply}</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Line Diff Body */}
      <div className="flex-1 overflow-auto bg-[#0d1117] p-2">
        <table className="w-full border-collapse">
          <tbody>
            {diff.lines.map((line, idx) => {
              const isAddition = line.type === 'addition';
              const isDeletion = line.type === 'deletion';

              return (
                <tr
                  key={idx}
                  className={`leading-5 ${
                    isAddition
                      ? 'bg-emerald-950/40 text-emerald-300'
                      : isDeletion
                      ? 'bg-red-950/40 text-red-300'
                      : 'text-gray-400 hover:bg-[#161b22]'
                  }`}
                >
                  {/* Original line number */}
                  <td className="w-10 text-right pr-2 select-none text-gray-600 border-r border-[#21262d]">
                    {line.originalLineNumber || ''}
                  </td>
                  {/* Modified line number */}
                  <td className="w-10 text-right pr-2 select-none text-gray-600 border-r border-[#21262d]">
                    {line.modifiedLineNumber || ''}
                  </td>
                  {/* Diff marker */}
                  <td className="w-6 text-center select-none font-bold">
                    {isAddition ? '+' : isDeletion ? '-' : ' '}
                  </td>
                  {/* Content line */}
                  <td className="pl-2 whitespace-pre font-mono select-text">
                    {line.content}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
