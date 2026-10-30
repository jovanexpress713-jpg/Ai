import { getProviderConfig, listProviderConfigs } from './config.ts';
import { generateWithProvider } from './providers/index.ts';
import {
  ProviderRequestError,
  type GenerateRequest,
  type GenerateResult,
  type ProviderDependencies,
  type ProviderEnvironment,
  type ProviderId,
} from './types.ts';

export type ModelTaskCategory =
  | 'planning'
  | 'coding'
  | 'design'
  | 'debugging'
  | 'review'
  | 'testing'
  | 'documentation';

export interface RoutedGenerateRequest extends GenerateRequest {
  provider?: ProviderId;
  taskCategory?: ModelTaskCategory;
}

export interface RoutedGenerateResult extends GenerateResult {
  attemptedProviders: ProviderId[];
}

export interface RouterDependencies extends ProviderDependencies {
  generate?: (provider: ProviderId, request: GenerateRequest, dependencies: ProviderDependencies) => Promise<GenerateResult>;
  maxAttempts?: number;
}

const DEFAULT_PROVIDER_ORDER: readonly ProviderId[] = [
  'gemini',
  'ollama',
  'openrouter',
  'anthropic',
  'openai',
];

const TASK_PROVIDER_ENV: Record<ModelTaskCategory, string> = {
  planning: 'FORGEX_PLANNING_PROVIDER',
  coding: 'FORGEX_CODING_PROVIDER',
  design: 'FORGEX_DESIGN_PROVIDER',
  debugging: 'FORGEX_DEBUGGING_PROVIDER',
  review: 'FORGEX_REVIEW_PROVIDER',
  testing: 'FORGEX_TESTING_PROVIDER',
  documentation: 'FORGEX_DOCUMENTATION_PROVIDER',
};

const TRANSIENT_ERRORS = new Set([
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR',
  'UNAVAILABLE',
]);

function configuredProviderOrder(env: ProviderEnvironment, taskCategory?: ModelTaskCategory): ProviderId[] {
  const configured = new Set(listProviderConfigs(env).filter((item) => item.configured).map((item) => item.id));
  const taskPreference = taskCategory ? env[TASK_PROVIDER_ENV[taskCategory]]?.trim() : undefined;
  const preferred = (taskPreference || env.FORGEX_DEFAULT_PROVIDER?.trim()) as ProviderId | undefined;
  const preferredIsValid = preferred && DEFAULT_PROVIDER_ORDER.includes(preferred);
  const ordered = preferredIsValid
    ? [preferred, ...DEFAULT_PROVIDER_ORDER.filter((id) => id !== preferred)]
    : [...DEFAULT_PROVIDER_ORDER];
  return ordered.filter((id) => configured.has(id));
}

/**
 * Deterministic, single-provider-at-a-time routing. Credentials are never
 * copied into the result. Authentication/configuration/invalid-response
 * errors are terminal; only transient service failures can fall back.
 */
export async function routeModelRequest(
  request: RoutedGenerateRequest,
  dependencies: RouterDependencies = {},
): Promise<RoutedGenerateResult> {
  if (!request.prompt.trim()) {
    throw new ProviderRequestError(request.provider || 'gemini', 'UPSTREAM_ERROR', 'A non-empty prompt is required.');
  }

  if (request.model !== undefined && !request.model.trim()) {
    throw new ProviderRequestError(request.provider || 'gemini', 'UPSTREAM_ERROR', 'An explicit model override must be a non-empty model identifier.');
  }

  const env = dependencies.env ?? process.env;
  const configured = configuredProviderOrder(env, request.taskCategory);
  let candidates: ProviderId[];

  if (request.provider) {
    const explicit = getProviderConfig(env, request.provider);
    if (!explicit.configured) {
      throw new ProviderRequestError(request.provider, 'NOT_CONFIGURED', `${request.provider} is not configured; explicit provider selection will not silently switch.`);
    }
    candidates = [request.provider, ...configured.filter((id) => id !== request.provider)];
  } else {
    candidates = configured;
  }

  if (!candidates.length) {
    throw new ProviderRequestError('gemini', 'NOT_CONFIGURED', 'No AI provider is configured. Configure Gemini, Anthropic, OpenAI, OpenRouter, or Ollama.');
  }

  const requestedAttempts = Number.isFinite(dependencies.maxAttempts) ? Math.floor(dependencies.maxAttempts!) : 3;
  const maxAttempts = Math.min(3, Math.max(1, requestedAttempts));
  const attemptedProviders: ProviderId[] = [];
  const generate = dependencies.generate ?? ((provider, input, deps) => generateWithProvider(provider, input, deps));
  let lastError: ProviderRequestError | undefined;

  for (const provider of candidates.slice(0, maxAttempts)) {
    attemptedProviders.push(provider);
    try {
      const result = await generate(provider, {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.provider === provider ? request.model : undefined,
        maxOutputTokens: request.maxOutputTokens,
        timeoutMs: request.timeoutMs,
      }, dependencies);
      return { ...result, attemptedProviders };
    } catch (error) {
      const normalized = error instanceof ProviderRequestError
        ? error
        : new ProviderRequestError(provider, 'UNAVAILABLE', 'Provider request failed unexpectedly.');
      lastError = normalized;
      if (!TRANSIENT_ERRORS.has(normalized.code)) throw normalized;
    }
  }

  throw lastError || new ProviderRequestError(candidates[0], 'UNAVAILABLE', 'No configured provider could complete the request.');
}
