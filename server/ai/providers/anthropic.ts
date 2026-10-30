import type { GenerateRequest, GenerateResult, ProviderUsage } from '../types.ts';
import { ProviderRequestError } from '../types.ts';
import { requestProviderJson } from './openai-compatible.ts';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export async function generateAnthropic(
  apiKey: string,
  model: string,
  request: GenerateRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<GenerateResult> {
  const started = Date.now();
  const payload: Record<string, unknown> = {
    model,
    max_tokens: Math.min(8192, Math.max(1, Math.floor(request.maxOutputTokens ?? 2048))),
    messages: [{ role: 'user', content: request.prompt }],
  };
  if (request.systemPrompt) payload.system = request.systemPrompt;

  const response = await requestProviderJson(
    'anthropic',
    ANTHROPIC_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    },
    request.timeoutMs ?? 30000,
    fetchImpl,
  );

  const content = Array.isArray(response.content) ? response.content : [];
  const text = content
    .filter((part: any) => part?.type === 'text' && typeof part.text === 'string')
    .map((part: any) => part.text)
    .join('');
  if (!text.trim()) {
    throw new ProviderRequestError('anthropic', 'INVALID_RESPONSE', 'Anthropic response did not contain generated text.');
  }

  const usage: ProviderUsage = {};
  const inputTokens = Number(response.usage?.input_tokens);
  const outputTokens = Number(response.usage?.output_tokens);
  if (Number.isFinite(inputTokens) && inputTokens >= 0) usage.inputTokens = inputTokens;
  if (Number.isFinite(outputTokens) && outputTokens >= 0) usage.outputTokens = outputTokens;

  return {
    provider: 'anthropic',
    model,
    text,
    latencyMs: Date.now() - started,
    usage: Object.keys(usage).length ? usage : undefined,
  };
}
