import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Code2, Cpu, FileCode2, Play, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Language } from '../../lib/i18n';

interface ProjectProfile {
  name: string;
  projectType: string;
  language: string;
  framework: string;
  packageManager: string | null;
  scripts: string[];
  platforms: string[];
  manifests: string[];
  warnings: string[];
}
interface LabCheck { id: string; label: string; category: 'static' | 'execution'; status: 'PASSED' | 'FAILED' | 'BLOCKED' | 'NOT_RUN'; detail: string }
interface LabExecutionResult { check: 'build' | 'test'; status: 'PASSED' | 'FAILED' | 'BLOCKED' | 'TIMEOUT'; command: string; exitCode: number | null; durationMs: number; stdout: string; stderr: string; timedOut: boolean }
interface LabRun { id: string; status: string; checks: LabCheck[]; commandsExecuted: string[]; execution?: { startedAt: string; finishedAt: string; results: LabExecutionResult[] }; createdAt: string }
interface ProjectLabViewProps { lang: Language }

export const ProjectLabView: React.FC<ProjectLabViewProps> = ({ lang }) => {
  const rtl = lang === 'ar';
  const [profile, setProfile] = useState<ProjectProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspection, setInspection] = useState<LabRun | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [runningChecks, setRunningChecks] = useState<('build' | 'test')[]>([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/lab/profile');
      const data = await response.json();
      if (!response.ok || data.success !== true || !data.profile) throw new Error(data.error || (rtl ? 'تعذر فحص المشروع.' : 'Project detection failed.'));
      setProfile(data.profile);
      const historyResponse = await fetch('/api/lab/runs');
      const history = await historyResponse.json();
      if (historyResponse.ok && Array.isArray(history.runs) && history.runs[0]) setInspection(history.runs[0]);
    } catch (err: any) {
      setError(err?.message || (rtl ? 'تعذر الاتصال بالخادم.' : 'Could not reach the server.'));
    } finally { setLoading(false); }
  }, [rtl]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const label = (value: string) => value.replaceAll('-', ' ').replaceAll('_', ' ');

  const runInspection = async () => {
    setInspecting(true); setError('');
    try {
      const response = await fetch('/api/lab/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await response.json();
      if (!response.ok || data.success !== true || !data.run) throw new Error(data.error || (rtl ? 'فشل الفحص الثابت.' : 'Static inspection failed.'));
      setInspection(data.run);
    } catch (err: any) { setError(err?.message || (rtl ? 'تعذر تنفيذ الفحص.' : 'Could not run inspection.')); }
    finally { setInspecting(false); }
  };

  const runChecks = async (checks: ('build' | 'test')[]) => {
    setRunningChecks(checks); setError('');
    try {
      const response = await fetch('/api/lab/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checks }) });
      const data = await response.json();
      if (!response.ok || !data.run) throw new Error(data.error || (rtl ? 'فشل تنفيذ الفحص.' : 'Project execution failed.'));
      setInspection(data.run);
      if (!data.success) setError(rtl ? 'اكتمل التنفيذ لكن أحد الاختبارات فشل؛ راجع التفاصيل أدناه.' : 'Execution completed, but one or more checks failed; review the details below.');
    } catch (err: any) { setError(err?.message || (rtl ? 'تعذر تنفيذ المشروع.' : 'Could not execute project.')); }
    finally { setRunningChecks([]); }
  };

  const checkStatusLabel = (status: LabCheck['status']) => ({
    PASSED: rtl ? 'اجتاز' : 'Passed', FAILED: rtl ? 'فشل' : 'Failed', BLOCKED: rtl ? 'متعذر' : 'Blocked', NOT_RUN: rtl ? 'لم يُشغّل' : 'Not run',
  }[status]);
  const executionStatusLabel = (status: LabExecutionResult['status']) => ({
    PASSED: rtl ? 'نجح' : 'Passed', FAILED: rtl ? 'فشل' : 'Failed', BLOCKED: rtl ? 'متعذر' : 'Blocked', TIMEOUT: rtl ? 'انتهى الوقت' : 'Timed out',
  }[status]);

  const info = [
    { label: rtl ? 'نوع المشروع' : 'Project type', value: profile?.projectType },
    { label: rtl ? 'لغة البرمجة' : 'Language', value: profile?.language },
    { label: rtl ? 'الإطار التقني' : 'Framework', value: profile?.framework },
    { label: rtl ? 'مدير الحزم' : 'Package manager', value: profile?.packageManager || (rtl ? 'غير محدد' : 'Not detected') },
  ];

  return (
    <main className="forge-page" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="forge-page-kicker"><Activity size={14} /> FORGEX AI / PROJECT LAB</div>
      <div className="forge-page-heading-row">
        <div>
          <h1 className="forge-page-title">{rtl ? 'مختبر المشروع' : 'Project Laboratory'}</h1>
          <p className="forge-page-subtitle">{rtl ? 'فحص ملفات المشروع وتشغيل أوامر البناء والاختبار الحقيقية قبل أن يدّعي FORGEX أن المشروع يعمل.' : 'Inspect the project and run its real build/test scripts before FORGEX reports a working result.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadProfile()} disabled={loading || inspecting || runningChecks.length > 0} className="forge-language-button">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {rtl ? 'إعادة قراءة المشروع' : 'Rescan project'}
          </button>
          <button type="button" onClick={() => void runInspection()} disabled={loading || inspecting || runningChecks.length > 0 || !profile} className="forge-language-button">
            <Activity size={14} className={inspecting ? 'animate-pulse' : ''} /> {inspecting ? (rtl ? 'يجري الفحص...' : 'Inspecting...') : (rtl ? 'فحص البنية' : 'Inspect project')}
          </button>
        </div>
      </div>

      {loading && <div className="forge-tool-detail"><RefreshCw size={18} className="animate-spin" /><span>{rtl ? 'يجري فحص ملفات المشروع...' : 'Scanning project manifests...'}</span></div>}
      {!loading && error && <div className="forge-unavailable-note"><AlertTriangle size={16} /> {error}</div>}
      {!loading && profile && (
        <>
          <section className="forge-creative-hero">
            <div className="forge-creative-hero-copy">
              <div className="forge-eyebrow">{rtl ? 'ملف المشروع المكتشف' : 'DETECTED PROJECT PROFILE'}</div>
              <h2>{profile.name}</h2>
              <p>{rtl ? 'تم استخراج المعلومات من ملفات المشروع الموجودة. الفحص الثابت لا يشغل كود المشروع.' : 'Profile data was read from the existing project manifests. Static inspection does not execute project code.'}</p>
              <div className="forge-hero-note"><ShieldCheck size={15} /> {rtl ? 'فحص قراءة فقط' : 'Read-only inspection'}</div>
            </div>
            <div className="forge-creative-art">
              <div className="forge-art-orbit" /><div className="forge-art-orbit forge-art-orbit-two" />
              <div className="forge-art-float forge-art-float-a"><Code2 size={20} /></div><div className="forge-art-float forge-art-float-b"><Cpu size={20} /></div>
              <div className="forge-art-device"><div className="forge-art-device-top" /><div className="forge-art-screen-glow" /><div className="forge-art-screen-lines"><i /><i /><i /></div></div>
            </div>
          </section>

          <div className="forge-section-heading"><div><h3>{rtl ? 'البنية التقنية' : 'Technology profile'}</h3><p>{rtl ? 'بيانات مستخرجة من ملفات المشروع' : 'Values detected from project manifests'}</p></div><span className="forge-section-count">{info.length} {rtl ? 'حقول' : 'FIELDS'}</span></div>
          <div className="forge-creative-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            {info.map((item) => <div className="forge-tool-card" key={item.label}><div className="forge-tool-visual"><FileCode2 size={25} /></div><div className="forge-tool-copy"><h4>{item.label}</h4><p>{label(item.value || 'unknown')}</p></div></div>)}
          </div>

          <div className="forge-section-heading"><div><h3>{rtl ? 'منصات الاستهداف' : 'Target platforms'}</h3><p>{rtl ? 'المنصات التي تشير إليها ملفات المشروع' : 'Platforms inferred from project files'}</p></div></div>
          <div className="flex flex-wrap gap-2">{profile.platforms.map((platform) => <span key={platform} className="forge-owner-pill">{label(platform)}</span>)}{!profile.platforms.length && <span className="text-slate-500 text-sm">{rtl ? 'لم يتم تحديد منصات' : 'No target platform detected'}</span>}</div>

          <div className="forge-section-heading"><div><h3>{rtl ? 'أوامر المشروع' : 'Project scripts'}</h3><p>{rtl ? 'البناء والاختبار ينفذان فعليًا من داخل المختبر.' : 'Build and test are executed for real by the Lab.'}</p></div></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void runChecks(['build'])} disabled={loading || inspecting || runningChecks.length > 0 || !profile?.scripts.includes('build')} className="forge-language-button"><Play size={14} /> {runningChecks.includes('build') ? (rtl ? 'يجري البناء...' : 'Building...') : (rtl ? 'تشغيل البناء' : 'Run build')}</button>
            <button type="button" onClick={() => void runChecks(['test'])} disabled={loading || inspecting || runningChecks.length > 0 || !profile?.scripts.includes('test')} className="forge-language-button"><Play size={14} /> {runningChecks.includes('test') ? (rtl ? 'يجري الاختبار...' : 'Testing...') : (rtl ? 'تشغيل الاختبارات' : 'Run tests')}</button>
            <button type="button" onClick={() => void runChecks(['build', 'test'])} disabled={loading || inspecting || runningChecks.length > 0 || (!profile?.scripts.includes('build') && !profile?.scripts.includes('test'))} className="forge-language-button"><Activity size={14} /> {rtl ? 'تشغيل الكل' : 'Run all checks'}</button>
          </div>
          <div className="forge-tool-detail mt-3"><div className="forge-tool-detail-icon"><CheckCircle2 size={19} /></div><div className="forge-tool-detail-copy"><h3>{rtl ? 'ملفات التعريف' : 'Detected manifests'}</h3><p>{profile.manifests.length ? profile.manifests.join(' · ') : (rtl ? 'لم يتم العثور على ملفات تعريف مدعومة.' : 'No supported manifests found.')}</p></div></div>
          <div className="flex flex-wrap gap-2 mt-3">{profile.scripts.map((script) => <span key={script} className="forge-owner-pill">{script}</span>)}{!profile.scripts.length && <span className="text-slate-500 text-sm">{rtl ? 'لا توجد أوامر package.json' : 'No package.json scripts found'}</span>}</div>
          {profile.warnings.map((warning) => <div key={warning} className="forge-unavailable-note mt-3"><AlertTriangle size={15} /> {warning}</div>)}

          {inspection && (
            <section className="mt-7 rounded-2xl border border-white/10 bg-[#11161d] p-5">
              <div className="flex items-center justify-between gap-3 mb-4"><div><h3 className="text-sm font-semibold">{inspection.status === 'EXECUTED' ? (rtl ? 'نتيجة التنفيذ الحقيقي' : 'Real execution result') : (rtl ? 'تقرير الفحص الثابت' : 'Static inspection report')}</h3><p className="text-[10px] text-slate-500 mt-1">{new Date(inspection.createdAt).toLocaleString()}</p></div><span className="forge-owner-pill">{inspection.status}</span></div>
              <div className="flex flex-col gap-3">
                {inspection.checks.map((check) => <div key={check.id} className="flex items-start gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0"><span className={check.status === 'PASSED' ? 'text-emerald-300' : check.status === 'FAILED' ? 'text-rose-300' : 'text-amber-200'}>{check.status === 'PASSED' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-xs">{check.label}</strong><span className="text-[9px] text-slate-400">{checkStatusLabel(check.status)}</span></div><p className="text-[10px] text-slate-500 mt-1">{check.detail}</p></div></div>)}
              </div>
              {inspection.execution?.results.map((result) => <div key={result.check} className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-xs">{result.check === 'build' ? (rtl ? 'البناء' : 'Build') : (rtl ? 'الاختبارات' : 'Tests')}</strong><span className="text-[10px]">{result.status === 'PASSED' ? <CheckCircle2 size={14} className="inline text-emerald-300" /> : <XCircle size={14} className="inline text-rose-300" />} {executionStatusLabel(result.status)} · {result.durationMs}ms</span></div><p className="text-[10px] text-slate-500 mt-2">{result.command || result.stderr}</p>{(result.stdout || result.stderr) && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-slate-400">{result.stdout || result.stderr}</pre>}</div>)}
              <p className="text-[10px] text-slate-500 mt-4">{rtl ? 'الأوامر التي تم تشغيلها فعليًا: ' : 'Commands actually executed: '}{inspection.commandsExecuted.length}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
};
