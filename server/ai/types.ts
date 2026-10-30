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

export type ProviderErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE'
  | 'RESPONSE_TOO_LARGE';

export interface GenerateRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface GenerateResult {
  provider: ProviderId;
  model: string;
  text: string;
  latencyMs: number;
  usage?: ProviderUsage;
}

export interface GeminiGenerateInput {
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxOutputTokens: number;
}

export interface ProviderDependencies {
  env?: ProviderEnvironment;
  fetchImpl?: typeof fetch;
  geminiGenerate?: (input: GeminiGenerateInput) => Promise<{ text?: string | null }>;
}

export interface ProviderConnectionResult {
  provider: ProviderId;
  configured: boolean;
  connected: boolean;
  status: ProviderStatus;
  model?: string;
  latencyMs?: number;
  error?: string;
}
