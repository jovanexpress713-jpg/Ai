import { PROVIDER_IDS, type ProviderConfig, type ProviderEnvironment, type ProviderId } from './types.ts';

const PLACEHOLDER_VALUES = new Set([
  'your_api_key',
  'your-api-key',
  'change_me',
  'changeme',
  'replace_me',
  'replace-me',
  'my_gemini_api_key',
]);

const MODEL_ENV: Record<ProviderId, string> = {
  gemini: 'FORGEX_GEMINI_MODEL',
  anthropic: 'ANTHROPIC_MODEL',
  openai: 'OPENAI_MODEL',
  openrouter: 'OPENROUTER_MODEL',
  ollama: 'OLLAMA_MODEL',
};

const DEFAULT_MODELS: Partial<Record<ProviderId, string>> = {
  gemini: 'gemini-3.1-flash-lite',
  anthropic: 'claude-3-5-haiku-latest',
  openai: 'gpt-4.1-mini',
  openrouter: 'openai/gpt-4.1-mini',
};

function readValue(env: ProviderEnvironment, name: string): string {
  return typeof env[name] === 'string' ? env[name]!.trim() : '';
}

function isConfiguredSecret(value: string): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (PLACEHOLDER_VALUES.has(normalized)) return false;
  if (/^(your|my|replace|change)[-_ ]/.test(normalized)) return false;
  if (/^<.*>$/.test(value) || /^\.{3,}$/.test(value)) return false;
  return true;
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

function createConfig(
  id: ProviderId,
  configured: boolean,
  model: string,
  baseUrl: string | null,
): ProviderConfig {
  return {
    id,
    configured,
    status: configured ? 'CONFIGURED_UNTESTED' : 'NOT_CONFIGURED',
    model: model || null,
    baseUrl,
  };
}

/**
 * Returns safe provider metadata only. Credentials are deliberately never
 * included in ProviderConfig; adapters read their secrets from the runtime env.
 */
export function getProviderConfig(env: ProviderEnvironment, providerId: ProviderId): ProviderConfig {
  const model = readValue(env, MODEL_ENV[providerId]) || DEFAULT_MODELS[providerId] || '';

  switch (providerId) {
    case 'gemini':
      return createConfig(providerId, isConfiguredSecret(readValue(env, 'GEMINI_API_KEY')), model, null);
    case 'anthropic':
      return createConfig(providerId, isConfiguredSecret(readValue(env, 'ANTHROPIC_API_KEY')), model, 'https://api.anthropic.com/v1');
    case 'openai':
      return createConfig(providerId, isConfiguredSecret(readValue(env, 'OPENAI_API_KEY')), model, 'https://api.openai.com/v1');
    case 'openrouter':
      return createConfig(providerId, isConfiguredSecret(readValue(env, 'OPENROUTER_API_KEY')), model, 'https://openrouter.ai/api/v1');
    case 'ollama': {
      const baseUrl = readValue(env, 'OLLAMA_BASE_URL');
      const ollamaModel = readValue(env, 'OLLAMA_MODEL');
      const configured = validHttpUrl(baseUrl) && Boolean(ollamaModel);
      return createConfig(providerId, configured, ollamaModel, validHttpUrl(baseUrl) ? baseUrl.replace(/\/$/, '') : null);
    }
  }
}

export function listProviderConfigs(env: ProviderEnvironment = process.env): ProviderConfig[] {
  return PROVIDER_IDS.map((id) => getProviderConfig(env, id));
}
