export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter' | 'ollama';

export type ProviderStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED_UNTESTED'
  | 'CONNECTED'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE';

export interface ProviderConfig {
  id: ProviderId;
  configured: boolean;
  status: ProviderStatus;
  model: string | null;
  baseUrl: string | null;
}

export const PROVIDER_IDS: readonly ProviderId[] = [
  'gemini',
  'anthropic',
  'openai',
  'openrouter',
  'ollama',
] as const;

export type ProviderEnvironment = Readonly<Record<string, string | undefined>>;
