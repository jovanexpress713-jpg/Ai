import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Cpu, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import { Language } from '../../lib/i18n';

type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter' | 'ollama';
interface ProviderInfo {
  id: ProviderId;
  configured: boolean;
  status: string;
  model: string | null;
  baseUrl: string | null;
}
interface ProviderTest {
  configured: boolean;
  connected: boolean;
  status: string;
  model?: string;
  latencyMs?: number;
  error?: string;
}

const PROVIDER_LABELS: Record<ProviderId, { title: string; description: string }> = {
  gemini: { title: 'Google Gemini', description: 'Gemini API — default low-cost cloud provider' },
  anthropic: { title: 'Anthropic Claude', description: 'Claude Messages API' },
  openai: { title: 'OpenAI', description: 'OpenAI Chat Completions API' },
  openrouter: { title: 'OpenRouter', description: 'OpenAI-compatible model gateway' },
  ollama: { title: 'Ollama Local', description: 'Self-hosted local model endpoint' },
};

interface AIProvidersViewProps { lang: Language }

export const AIProvidersView: React.FC<AIProvidersViewProps> = ({ lang }) => {
  const rtl = lang === 'ar';
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [tests, setTests] = useState<Record<string, ProviderTest>>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [error, setError] = useState('');

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai/providers');
      const data = await response.json();
      if (!response.ok || data.success !== true || !Array.isArray(data.providers)) {
        throw new Error(data.error || (rtl ? 'تعذر تحميل إعدادات النماذج.' : 'Could not load provider settings.'));
      }
      setProviders(data.providers);
    } catch (err: any) {
      setError(err?.message || (rtl ? 'تعذر الاتصال بالخادم.' : 'Could not reach the server.'));
    } finally {
      setLoading(false);
    }
  }, [rtl]);

  useEffect(() => { void loadProviders(); }, [loadProviders]);

  const testProvider = async (provider: ProviderId) => {
    setTesting(provider);
    setError('');
    try {
      const response = await fetch('/api/ai/providers/' + provider + '/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await response.json();
      if (!data.result) throw new Error(data.error || (rtl ? 'لم تصل نتيجة الفحص.' : 'No diagnostic result was returned.'));
      setTests((previous) => ({ ...previous, [provider]: data.result }));
    } catch (err: any) {
      setTests((previous) => ({ ...previous, [provider]: { configured: false, connected: false, status: 'UNAVAILABLE', error: err?.message || 'Connection test failed.' } }));
    } finally {
      setTesting(null);
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      NOT_CONFIGURED: ['غير مهيأ', 'Not configured'],
      CONFIGURED_UNTESTED: ['مهيأ — لم يُختبر', 'Configured · untested'],
      CONNECTED: ['متصل ومتحقق منه', 'Connected · verified'],
      AUTH_ERROR: ['خطأ في بيانات الاعتماد', 'Authentication error'],
      RATE_LIMITED: ['تجاوز حد الطلبات', 'Rate limited'],
      UNAVAILABLE: ['غير متاح', 'Unavailable'],
    };
    return labels[status] ? labels[status][rtl ? 0 : 1] : status;
  };

  return (
    <main className="forge-page" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="forge-page-kicker"><Cpu size={14} /> FORGEX AI / MODEL ROUTING</div>
      <div className="forge-page-heading-row">
        <div>
          <h1 className="forge-page-title">{rtl ? 'النماذج والتكاملات' : 'Models & Integrations'}</h1>
          <p className="forge-page-subtitle">{rtl ? 'تحكم في مزودي الذكاء الاصطناعي، افحص الاتصال الحقيقي، وحدد مزوداً افتراضياً من إعدادات الخادم.' : 'Inspect AI provider configuration, run real connection diagnostics, and choose routing preferences through server environment settings.'}</p>
        </div>
        <button type="button" onClick={() => void loadProviders()} disabled={loading} className="forge-language-button">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{rtl ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      <div className="forge-tool-detail mb-5">
        <div className="forge-tool-detail-icon"><ShieldCheck size={19} /></div>
        <div className="forge-tool-detail-copy">
          <h3>{rtl ? 'حماية مفاتيح الربط' : 'Credential protection'}</h3>
          <p>{rtl ? 'مفاتيح API تُقرأ من بيئة الخادم فقط. لا تُعرض هنا ولا تُحفظ في المتصفح. أضفها إلى إعدادات استضافة الخادم، وليس إلى المحادثة.' : 'API keys are read only from the server environment. They are never displayed or stored in the browser. Configure them in your server host settings, not in chat.'}</p>
        </div>
      </div>

      {loading && <div className="forge-tool-detail"><RefreshCw size={17} className="animate-spin" />{rtl ? 'تحميل إعدادات المزودين...' : 'Loading provider configuration...'}</div>}
      {!loading && error && <div className="forge-unavailable-note"><AlertCircle size={16} />{error}</div>}

      {!loading && <div className="flex flex-col gap-3">
        {providers.map((provider) => {
          const test = tests[provider.id];
          const status = test?.status || provider.status;
          const connected = status === 'CONNECTED';
          const configured = test?.configured ?? provider.configured;
          const labels = PROVIDER_LABELS[provider.id];
          return (
            <section key={provider.id} className="forge-tool-detail">
              <div className="forge-tool-detail-icon"><Cpu size={19} /></div>
              <div className="forge-tool-detail-copy">
                <h3>{labels.title}</h3>
                <p>{labels.description}</p>
                <p className="mt-1">{rtl ? 'النموذج' : 'Model'}: {test?.model || provider.model || (rtl ? 'غير محدد' : 'Not set')}</p>
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  {connected ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Activity size={14} className="text-amber-300" />}
                  <span className={connected ? 'text-emerald-300' : 'text-amber-200'}>{statusLabel(status)}</span>
                  {typeof test?.latencyMs === 'number' && <span className="text-slate-500">{test.latencyMs} ms</span>}
                </div>
                {test?.error && <p className="mt-2 text-rose-300">{test.error}</p>}
              </div>
              <button type="button" disabled={testing !== null || !configured} onClick={() => void testProvider(provider.id)} className="forge-language-button disabled:opacity-40">
                {testing === provider.id ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
                {rtl ? 'اختبار الاتصال' : 'Test connection'}
              </button>
            </section>
          );
        })}
      </div>}

      <div className="forge-unavailable-note mt-6">{rtl ? 'ملاحظة: لا يمكن اختبار مزود غير مهيأ. كما أن اختبارات المحاكاة في CI لا تعني أن حسابك متصل؛ الاتصال الحقيقي يحتاج مفتاحاً صحيحاً أو خادماً محلياً متاحاً.' : 'Note: an unconfigured provider cannot be tested. CI adapter fixtures do not mean your account is connected; live verification requires valid credentials or a reachable local server.'}</div>
    </main>
  );
};
