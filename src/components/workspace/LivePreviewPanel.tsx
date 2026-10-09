import React from 'react';
import { Language } from '../../lib/i18n';

interface LivePreviewPanelProps {
  lang?: Language | string;
}

export function LivePreviewPanel({ lang = 'ar' }: LivePreviewPanelProps) {
  const isArabic = lang === 'ar';
  return (
    <div className="p-8 bg-slate-900 text-slate-100 h-full flex flex-col justify-center items-center text-center" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/40 rounded-2xl flex items-center justify-center mb-4 text-indigo-400 text-2xl font-bold shadow-lg shadow-indigo-500/10">
        FX
      </div>
      <h2 className="text-2xl font-bold mb-2">
        {isArabic ? 'تم تطبيق التعديلات بنجاح' : 'Changes Applied Successfully'}
      </h2>
      <p className="text-slate-400 max-w-md text-sm leading-relaxed">
        {isArabic
          ? 'استناداً إلى طلبك: "أضف لوحة إحصائيات عصرية" - تم تحديث المكونات مع تطبيق كامل معايير تجربة المستخدم.'
          : 'Based on your request: "Add modern stats dashboard" - components have been updated following full UI/UX guidelines.'}
      </p>
    </div>
  );
}

export default LivePreviewPanel;

