import React, { useState } from 'react';
import {
  RotateCcw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { translations, Language } from '../../lib/i18n';

interface LivePreviewPanelProps {
  lang: Language;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({ lang }) => {
  const t = translations[lang];
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [iframeKey, setIframeKey] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const previewUrl = window.location.origin;

  const reloadPreview = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const getViewportWidth = () => {
    switch (viewportMode) {
      case 'tablet':
        return '768px';
      case 'mobile':
        return '375px';
      default:
        return '100%';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-hidden">
      {/* Preview Navigation Toolbar */}
      <div className="p-2.5 px-4 bg-[#161b22] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white">
            {lang === 'ar' ? 'المعاينة الحية للتطبيق' : 'Live Web Preview'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
            {previewUrl}
          </span>
        </div>

        {/* Viewport controls & Reload */}
        <div className="flex items-center gap-2">
          {/* Viewport switchers */}
          <div className="flex items-center bg-[#0d1117] p-0.5 rounded-lg border border-[#30363d]">
            <button
              onClick={() => setViewportMode('desktop')}
              className={`p-1.5 rounded transition-colors ${
                viewportMode === 'desktop' ? 'bg-[#21262d] text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
              title="Desktop Viewport (100%)"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewportMode('tablet')}
              className={`p-1.5 rounded transition-colors ${
                viewportMode === 'tablet' ? 'bg-[#21262d] text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
              title="Tablet Viewport (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewportMode('mobile')}
              className={`p-1.5 rounded transition-colors ${
                viewportMode === 'mobile' ? 'bg-[#21262d] text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
              title="Mobile Viewport (375px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={reloadPreview}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 transition-colors"
            title="Reload preview iframe"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 overflow-auto bg-[#090d12] flex items-center justify-center p-2 sm:p-4 relative">
        <div
          style={{ width: getViewportWidth(), height: '100%', maxWidth: '100%' }}
          className="bg-white rounded-xl overflow-hidden shadow-2xl border border-[#30363d] transition-all flex flex-col relative"
        >
          <iframe
            key={iframeKey}
            src={previewUrl}
            onLoad={() => setIsLoading(false)}
            className="w-full h-full border-none"
            title="Application Live Preview"
          />
        </div>
      </div>
    </div>
  );
};
