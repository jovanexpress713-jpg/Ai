import { getProviderConfig } from '../config.ts';
import {
  ProviderRequestError,
  type GenerateRequest,
  type GenerateResult,
  type ProviderConnectionResult,
  type ProviderDependencies,
  type ProviderEnvironment,
  type ProviderId,
  type ProviderStatus,
} from '../types.ts';
import { generateAnthropic } from './anthropic.ts';
import { generateGemini } from './gemini.ts';
import { generateOpenAICompatible } from './openai-compatible.ts';

export { ProviderRequestError } from '../types.ts';
export type { GenerateRequest, GenerateResult, ProviderConnectionResult, ProviderDependencies } from '../types.ts';

function getEnv(dependencies?: ProviderDependencies): ProviderEnvironment {
  return dependencies?.env ?? process.env;
}

function getCredential(env: ProviderEnvironment, name: string): string {
  return env[name]?.trim() || '';
}

export async function generateWithProvider(
  providerId: ProviderId,
  request: GenerateRequest,
  dependencies: ProviderDependencies = {},
): Promise<GenerateResult> {
  if (!request.prompt.trim()) {
    throw new ProviderRequestError(providerId, 'UPSTREAM_ERROR', 'A non-empty prompt is required.');
  }

  const env = getEnv(dependencies);
  const config = getProviderConfig(env, providerId);
  if (!config.configured || !config.model) {
    throw new ProviderRequestError(providerId, 'NOT_CONFIGURED', `${providerId} is not configured.`);
  }

  switch (providerId) {
    case 'gemini':
      return generateGemini(
        getCredential(env, 'GEMINI_API_KEY'),
        request.model?.trim() || config.model,
        request,
        dependencies.geminiGenerate,
      );
    case 'anthropic':
      return generateAnthropic(
        getCredential(env, 'ANTHROPIC_API_KEY'),
        request.model?.trim() || config.model,
        request,
        dependencies.fetchImpl,
      );
    case 'openai':
      return generateOpenAICompatible(
        'openai',
        config.baseUrl!,
        getCredential(env, 'OPENAI_API_KEY'),
        request.model?.trim() || config.model,
        request,
        dependencies.fetchImpl,
      );
    case 'openrouter':
      return generateOpenAICompatible(
        'openrouter',
        config.baseUrl!,
        getCredential(env, 'OPENROUTER_API_KEY'),
        request.model?.trim() || config.model,
        request,
        dependencies.fetchImpl,
      );
    case 'ollama':
      return generateOpenAICompatible(
        'ollama',
        config.baseUrl!,
        undefined,
        request.model?.trim() || config.model,
        request,
        dependencies.fetchImpl,
      );
  }
}

function statusForError(error: ProviderRequestError): ProviderStatus {
  switch (error.code) {
    case 'NOT_CONFIGURED': return 'NOT_CONFIGURED';
    case 'AUTH_ERROR': return 'AUTH_ERROR';
    case 'RATE_LIMITED': return 'RATE_LIMITED';
    default: return 'UNAVAILABLE';
  }
}

export async function testProviderConnection(
  providerId: ProviderId,
  dependencies: ProviderDependencies = {},
): Promise<ProviderConnectionResult> {
  const env = getEnv(dependencies);
  const config = getProviderConfig(env, providerId);
  if (!config.configured) {
    return {
      provider: providerId,
      configured: false,
      connected: false,
      status: 'NOT_CONFIGURED',
      error: 'Provider credentials or required settings are not configured.',
    };
  }

  const started = Date.now();
  try {
    const result = await generateWithProvider(providerId, {
      prompt: 'Reply with exactly: PONG',
      maxOutputTokens: 16,
      timeoutMs: 12000,
    }, dependencies);
    return {
      provider: providerId,
      configured: true,
      connected: true,
      status: 'CONNECTED',
      model: result.model,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const normalized = error instanceof ProviderRequestError
      ? error
      : new ProviderRequestError(providerId, 'UNAVAILABLE', 'Provider connection test failed.');
    return {
      provider: providerId,
      configured: true,
      connected: false,
      status: statusForError(normalized),
      model: config.model || undefined,
      latencyMs: Date.now() - started,
      error: normalized.message,
    };
  }
}
