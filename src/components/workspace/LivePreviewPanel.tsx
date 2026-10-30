import React from 'react';
import { Language } from '../../lib/i18n';

interface LivePreviewPanelProps {
  lang?: Language | string;
}

export function LivePreviewPanel({ lang = 'ar' }: LivePreviewPanelProps) {
  const isArabic = lang === 'ar';
  return (
    <section
      className="h-full min-h-[180px] w-full flex flex-col items-center justify-center text-center p-5 sm:p-8 bg-slate-950 text-slate-100"
      dir={isArabic ? 'rtl' : 'ltr'}
      aria-live="polite"
    >
      <div className="w-14 h-14 rounded-2xl border border-amber-400/25 bg-amber-400/10 flex items-center justify-center mb-4 text-amber-300">
        <span className="text-xl font-bold">FX</span>
      </div>
      <span className="text-[10px] tracking-[.18em] uppercase text-amber-300/80 mb-2">
        {isArabic ? 'المعاينة' : 'PREVIEW'}
      </span>
      <h2 className="text-lg sm:text-xl font-semibold mb-2">
        {isArabic ? 'لا توجد معاينة مشروع فعلية بعد' : 'No live project preview yet'}
      </h2>
      <p className="text-slate-400 max-w-md text-xs sm:text-sm leading-7">
        {isArabic
          ? 'هذه المساحة لا تعرض حالياً تطبيقاً مولّداً أو ملفات مشروع قيد التشغيل. أرسل طلبك من مساحة الذكاء، ثم راجع التغييرات المقترحة داخل هندسة المشاريع قبل تطبيقها.'
          : 'This panel does not currently render a generated or running project. Send a request in AI Workspace, then review proposed changes in Engineering before applying them.'}
      </p>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[10px] text-slate-500">
        {isArabic ? 'الحالة: عرض توضيحي غير متصل بمصدر ملفات مباشر' : 'Status: illustrative panel, not connected to a live file renderer'}
      </div>
    </section>
  );
}

export default LivePreviewPanel;
