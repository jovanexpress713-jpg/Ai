import assert from 'node:assert/strict';
import { routeModelRequest } from '../server/ai/router.ts';
import { ProviderRequestError } from '../server/ai/types.ts';

const env = {
  GEMINI_API_KEY: 'gemini-secret',
  ANTHROPIC_API_KEY: 'anthropic-secret',
  OPENROUTER_API_KEY: 'openrouter-secret',
  OPENAI_API_KEY: 'openai-secret',
  OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
  OLLAMA_MODEL: 'qwen2.5:3b',
  FORGEX_DEFAULT_PROVIDER: 'gemini',
};
const successful = (provider: string) => async () => ({
  provider, model: provider + '-model', text: 'ok', latencyMs: 4,
} as any);

{
  const result = await routeModelRequest({ prompt: 'Plan a feature' }, { env, generate: successful('gemini') as any });
  assert.equal(result.provider, 'gemini', 'low-cost default should prefer configured Gemini');
  assert.deepEqual(result.attemptedProviders, ['gemini']);
}

{
  const result = await routeModelRequest({ prompt: 'Write tests', provider: 'ollama' }, { env, generate: successful('ollama') as any });
  assert.equal(result.provider, 'ollama', 'explicit configured provider must win');
}

{
  await assert.rejects(
    () => routeModelRequest({ prompt: 'x', provider: 'openrouter' }, { env: { GEMINI_API_KEY: 'gemini-secret' } }),
    (error: unknown) => error instanceof ProviderRequestError && error.code === 'NOT_CONFIGURED',
    'explicit unconfigured provider must fail without silently switching',
  );
}

{
  let attempts = 0;
  await assert.rejects(() => routeModelRequest({ prompt: 'x', provider: 'gemini' }, {
    env,
    generate: async () => { attempts += 1; throw new ProviderRequestError('gemini', 'AUTH_ERROR', 'bad credentials'); },
  }), (error: unknown) => error instanceof ProviderRequestError && error.code === 'AUTH_ERROR');
  assert.equal(attempts, 1, 'authentication errors must never trigger fallback');
}

{
  const attempted: string[] = [];
  const result = await routeModelRequest({ prompt: 'x', provider: 'gemini' }, {
    env, maxAttempts: 3,
    generate: async (provider: any) => {
      attempted.push(provider);
      if (provider === 'gemini') throw new ProviderRequestError(provider, 'RATE_LIMITED', 'limited');
      if (provider === 'ollama') throw new ProviderRequestError(provider, 'TIMEOUT', 'timeout');
      return { provider, model: 'openrouter-model', text: 'ok', latencyMs: 5 };
    },
  });
  assert.equal(result.provider, 'openrouter');
  assert.deepEqual(attempted, ['gemini', 'ollama', 'openrouter']);
  assert.deepEqual(result.attemptedProviders, attempted);
}

{
  let attempts = 0;
  await assert.rejects(() => routeModelRequest({ prompt: 'x', provider: 'gemini' }, {
    env, maxAttempts: 2,
    generate: async (provider: any) => { attempts += 1; throw new ProviderRequestError(provider, 'UNAVAILABLE', 'offline'); },
  }), (error: unknown) => error instanceof ProviderRequestError && error.code === 'UNAVAILABLE');
  assert.equal(attempts, 2, 'fallback attempts must be bounded');
}


{
  const result = await routeModelRequest({ prompt: 'Use the configured preference' }, {
    env: { ...env, FORGEX_DEFAULT_PROVIDER: 'ollama' },
    generate: successful('ollama') as any,
  });
  assert.equal(result.provider, 'ollama', 'configured default provider must be the first preference');
}

{
  await assert.rejects(
    () => routeModelRequest({ prompt: 'x', provider: 'gemini', model: '   ' }, { env }),
    (error: unknown) => error instanceof ProviderRequestError && error.code === 'UPSTREAM_ERROR',
    'blank explicit model overrides must be rejected rather than silently ignored',
  );
}


{
  const result = await routeModelRequest({ prompt: 'Design a visual system', taskCategory: 'design' }, {
    env: { ...env, FORGEX_DESIGN_PROVIDER: 'ollama' },
    generate: successful('ollama') as any,
  });
  assert.equal(result.provider, 'ollama', 'task-specific provider preference must override the global default');
}

console.log('Provider router tests: PASS');