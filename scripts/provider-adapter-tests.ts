import assert from 'node:assert/strict';
import { generateWithProvider, ProviderRequestError, testProviderConnection } from '../server/ai/providers/index.ts';

const env = {
  GEMINI_API_KEY: 'gemini-test-secret',
  ANTHROPIC_API_KEY: 'anthropic-test-secret',
  OPENAI_API_KEY: 'openai-test-secret',
  OPENROUTER_API_KEY: 'openrouter-test-secret',
  OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
  OLLAMA_MODEL: 'qwen2.5:3b',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function expectProviderError(run: () => Promise<unknown>, code: string): Promise<ProviderRequestError> {
  try {
    await run();
  } catch (error) {
    assert.ok(error instanceof ProviderRequestError);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail('Expected provider request to fail with ' + code);
}

{
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const result = await generateWithProvider('anthropic', {
    prompt: 'Create a concise plan',
    systemPrompt: 'You are an engineering planner',
    maxOutputTokens: 120,
  }, {
    env,
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return jsonResponse({ content: [{ type: 'text', text: 'Anthropic response' }], usage: { input_tokens: 12, output_tokens: 8 } });
    },
  });

  assert.equal(requestUrl, 'https://api.anthropic.com/v1/messages');
  assert.equal(result.text, 'Anthropic response');
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.model, 'claude-3-5-haiku-latest');
  assert.equal((requestInit?.headers as Record<string, string>)['x-api-key'], env.ANTHROPIC_API_KEY);
  assert.equal((requestInit?.headers as Record<string, string>)['anthropic-version'], '2023-06-01');
  const payload = JSON.parse(String(requestInit?.body));
  assert.equal(payload.system, 'You are an engineering planner');
  assert.equal(payload.messages[0].content, 'Create a concise plan');
  assert.equal(payload.max_tokens, 120);
}

{
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const result = await generateWithProvider('openai', { prompt: 'Write a test' }, {
    env,
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return jsonResponse({ choices: [{ message: { content: 'OpenAI response' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    },
  });
  assert.equal(requestUrl, 'https://api.openai.com/v1/chat/completions');
  assert.equal(result.text, 'OpenAI response');
  assert.equal(result.provider, 'openai');
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'Bearer ' + env.OPENAI_API_KEY);
  const payload = JSON.parse(String(requestInit?.body));
  assert.equal(payload.messages[0].content, 'Write a test');
}

{
  let requestUrl = '';
  const result = await generateWithProvider('openrouter', { prompt: 'Review this diff' }, {
    env,
    fetchImpl: async (input) => {
      requestUrl = String(input);
      return jsonResponse({ choices: [{ message: { content: 'Router response' } }] });
    },
  });
  assert.equal(requestUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(result.text, 'Router response');
}

{
  let requestInit: RequestInit | undefined;
  const result = await generateWithProvider('ollama', { prompt: 'Explain this function' }, {
    env,
    fetchImpl: async (_input, init) => {
      requestInit = init;
      return jsonResponse({ choices: [{ message: { content: 'Local response' } }] });
    },
  });
  assert.equal(result.text, 'Local response');
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, undefined);
}

{
  const result = await generateWithProvider('gemini', { prompt: 'Plan a feature' }, {
    env,
    geminiGenerate: async ({ model }) => ({ text: 'Gemini response', model }),
  });
  assert.equal(result.text, 'Gemini response');
  assert.equal(result.provider, 'gemini');
}

{
  const error = await expectProviderError(() => generateWithProvider('openai', { prompt: 'x' }, {
    env,
    fetchImpl: async () => jsonResponse({ error: { message: 'private upstream detail' } }, 401),
  }), 'AUTH_ERROR');
  assert.equal(error.message.includes(env.OPENAI_API_KEY), false);
  assert.equal(error.message.includes('private upstream detail'), false);
}

{
  await expectProviderError(() => generateWithProvider('anthropic', { prompt: 'x' }, {
    env,
    fetchImpl: async () => jsonResponse({ error: { message: 'busy' } }, 429),
  }), 'RATE_LIMITED');
}

{
  await expectProviderError(() => generateWithProvider('openai', { prompt: 'x' }, {
    env,
    fetchImpl: async () => jsonResponse({ choices: [] }),
  }), 'INVALID_RESPONSE');
}

{
  await expectProviderError(() => generateWithProvider('openai', { prompt: 'x' }, {
    env,
    fetchImpl: async () => new Response('x'.repeat(1024 * 1024 + 1), { status: 200 }),
  }), 'RESPONSE_TOO_LARGE');
}

{
  await expectProviderError(() => generateWithProvider('openai', { prompt: 'x', timeoutMs: 15 }, {
    env,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  }), 'TIMEOUT');
}

{
  const status = await testProviderConnection('openrouter', {
    env,
    fetchImpl: async () => jsonResponse({ choices: [{ message: { content: 'pong' } }] }),
  });
  assert.equal(status.configured, true);
  assert.equal(status.connected, true);
  assert.equal(status.status, 'CONNECTED');
}

console.log('Provider adapter tests: PASS');
