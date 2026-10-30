import { GoogleGenAI } from '@google/genai';
import type { GenerateRequest, GenerateResult, GeminiGenerateInput } from '../types.ts';
import { ProviderRequestError } from '../types.ts';

async function defaultGeminiGenerate(apiKey: string, input: GeminiGenerateInput): Promise<{ text?: string | null }> {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: input.model,
    contents: input.prompt,
    config: {
      ...(input.systemPrompt ? { systemInstruction: input.systemPrompt } : {}),
      maxOutputTokens: input.maxOutputTokens,
    },
  });
  return { text: response.text };
}

function classifyGeminiError(error: unknown): ProviderRequestError {
  const candidate = error as { status?: number; code?: number; name?: string; message?: string };
  const status = Number(candidate?.status ?? candidate?.code);
  if (status === 401 || status === 403) {
    return new ProviderRequestError('gemini', 'AUTH_ERROR', 'Gemini rejected the configured credentials.');
  }
  if (status === 429) {
    return new ProviderRequestError('gemini', 'RATE_LIMITED', 'Gemini rate limit or quota was reached.');
  }
  if (candidate?.name === 'AbortError' || /timeout|timed out/i.test(candidate?.message || '')) {
    return new ProviderRequestError('gemini', 'TIMEOUT', 'Gemini request timed out.');
  }
  return new ProviderRequestError('gemini', 'UNAVAILABLE', 'Gemini request failed; check provider availability and configuration.');
}

export async function generateGemini(
  apiKey: string,
  model: string,
  request: GenerateRequest,
  injectedGenerate?: (input: GeminiGenerateInput) => Promise<{ text?: string | null }>,
): Promise<GenerateResult> {
  const started = Date.now();
  const timeoutMs = request.timeoutMs ?? 30000;
  const input: GeminiGenerateInput = {
    model,
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    maxOutputTokens: Math.min(8192, Math.max(1, Math.floor(request.maxOutputTokens ?? 2048))),
  };

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = injectedGenerate
      ? injectedGenerate(input)
      : defaultGeminiGenerate(apiKey, input);
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new ProviderRequestError('gemini', 'TIMEOUT', 'Gemini request timed out.')), timeoutMs);
    });
    const response = await Promise.race([operation, timedOut]);
    if (typeof response.text !== 'string' || !response.text.trim()) {
      throw new ProviderRequestError('gemini', 'INVALID_RESPONSE', 'Gemini response did not contain generated text.');
    }
    return { provider: 'gemini', model, text: response.text, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    throw classifyGeminiError(error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
