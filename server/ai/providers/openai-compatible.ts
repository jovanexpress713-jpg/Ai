import type { GenerateRequest, GenerateResult, ProviderId, ProviderUsage } from '../types.ts';
import { ProviderRequestError } from '../types.ts';

const MAX_RESPONSE_BYTES = 1024 * 1024;

export async function requestProviderJson(
  provider: ProviderId,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, any>> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const operation = (async () => {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError(provider, 'RESPONSE_TOO_LARGE', 'Provider response exceeded the 1 MiB safety limit.');
    }

    let raw = '';
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) {
            await reader.cancel().catch(() => undefined);
            throw new ProviderRequestError(provider, 'RESPONSE_TOO_LARGE', 'Provider response exceeded the 1 MiB safety limit.');
          }
          raw += decoder.decode(chunk.value, { stream: true });
        }
        raw += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }

    if (!response.ok) {
      const code = response.status === 401 || response.status === 403
        ? 'AUTH_ERROR'
        : response.status === 429
          ? 'RATE_LIMITED'
          : response.status >= 500
            ? 'UNAVAILABLE'
            : 'UPSTREAM_ERROR';
      throw new ProviderRequestError(provider, code, `Provider request failed with HTTP ${response.status}.`);
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid object');
      return parsed as Record<string, any>;
    } catch {
      throw new ProviderRequestError(provider, 'INVALID_RESPONSE', 'Provider returned malformed JSON.');
    }
  })();

  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new ProviderRequestError(provider, 'TIMEOUT', 'Provider request timed out.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timedOut]);
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new ProviderRequestError(provider, 'TIMEOUT', 'Provider request timed out.');
    }
    throw new ProviderRequestError(provider, 'NETWORK_ERROR', 'Could not reach the configured provider endpoint.');
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function normalizeText(content: unknown, provider: ProviderId): string {
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((part) => part && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    if (text.trim()) return text;
  }
  throw new ProviderRequestError(provider, 'INVALID_RESPONSE', 'Provider response did not contain generated text.');
}

function normalizeUsage(usage: any): ProviderUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens);
  const normalized: ProviderUsage = {};
  if (Number.isFinite(inputTokens) && inputTokens >= 0) normalized.inputTokens = inputTokens;
  if (Number.isFinite(outputTokens) && outputTokens >= 0) normalized.outputTokens = outputTokens;
  return Object.keys(normalized).length ? normalized : undefined;
}

export async function generateOpenAICompatible(
  provider: ProviderId,
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  request: GenerateRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<GenerateResult> {
  const started = Date.now();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const messages = [];
  if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
  messages.push({ role: 'user', content: request.prompt });

  const payload = {
    model,
    messages,
    max_tokens: Math.min(8192, Math.max(1, Math.floor(request.maxOutputTokens ?? 2048))),
  };
  const response = await requestProviderJson(
    provider,
    `${baseUrl.replace(/\\/+$/, '')}/chat/completions`,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    request.timeoutMs ?? 30000,
    fetchImpl,
  );

  const choice = Array.isArray(response.choices) ? response.choices[0] : undefined;
  const text = normalizeText(choice?.message?.content, provider);
  return {
    provider,
    model,
    text,
    latencyMs: Date.now() - started,
    usage: normalizeUsage(response.usage),
  };
}
