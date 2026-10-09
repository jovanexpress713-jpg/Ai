import React from 'react';

export function LivePreviewPanel() {
  return (
    <div className="p-8 bg-slate-900 text-slate-100 h-full flex flex-col justify-center items-center text-center">
      <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/40 rounded-2xl flex items-center justify-center mb-4 text-indigo-400 text-2xl font-bold shadow-lg shadow-indigo-500/10">
        FX
      </div>
      <h2 className="text-2xl font-bold mb-2">تم تطبيق التعديلات بنجاح</h2>
      <p className="text-slate-400 max-w-md text-sm leading-relaxed">
        استناداً إلى طلبك: "أضف لوحة إحصائيات عصرية" - تم تحديث المكونات مع تطبيق كامل معايير تجربة المستخدم.
      </p>
    </div>
  );
}

export default LivePreviewPanel;
