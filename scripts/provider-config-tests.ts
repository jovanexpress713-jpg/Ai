import assert from 'node:assert/strict';
import { getProviderConfig, listProviderConfigs } from '../server/ai/config.ts';
import type { ProviderId } from '../server/ai/types.ts';

const ids: ProviderId[] = ['gemini', 'anthropic', 'openai', 'openrouter', 'ollama'];
const secret = 'sk-live-super-secret-value';

for (const id of ids) {
  const config = getProviderConfig({}, id);
  assert.equal(config.id, id);
  assert.equal(config.configured, false, id + ' must be unconfigured when environment is empty');
  assert.equal(config.status, 'NOT_CONFIGURED');
  assert.equal(JSON.stringify(config).includes(secret), false, 'provider config must never expose credentials');
}

const cases: Array<[ProviderId, Record<string, string>, string]> = [
  ['gemini', { GEMINI_API_KEY: '  ' }, 'blank credentials are not configured'],
  ['gemini', { GEMINI_API_KEY: 'MY_GEMINI_API_KEY' }, 'Gemini placeholder is not configured'],
  ['anthropic', { ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY' }, 'Anthropic placeholder is not configured'],
  ['openai', { OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY' }, 'OpenAI placeholder is not configured'],
  ['openrouter', { OPENROUTER_API_KEY: 'YOUR_OPENROUTER_API_KEY' }, 'OpenRouter placeholder is not configured'],
  ['ollama', { OLLAMA_BASE_URL: ' ', OLLAMA_MODEL: 'llama3.2' }, 'blank Ollama base URL is not configured'],
  ['ollama', { OLLAMA_BASE_URL: 'http://127.0.0.1:11434', OLLAMA_MODEL: ' ' }, 'blank Ollama model is not configured'],
];

for (const [id, env, message] of cases) {
  assert.equal(getProviderConfig(env, id).configured, false, message);
}

const configuredEnv: Record<string, string> = {
  GEMINI_API_KEY: secret,
  ANTHROPIC_API_KEY: 'anthropic-secret',
  OPENAI_API_KEY: 'openai-secret',
  OPENROUTER_API_KEY: 'router-secret',
  OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
  OLLAMA_MODEL: 'qwen2.5:3b',
};

for (const id of ids) {
  const config = getProviderConfig(configuredEnv, id);
  assert.equal(config.configured, true, id + ' should be configured');
  assert.equal(config.status, 'CONFIGURED_UNTESTED', id + ' must not claim a live connection');
  const serialized = JSON.stringify(config);
  for (const value of [secret, 'anthropic-secret', 'openai-secret', 'router-secret']) {
    assert.equal(serialized.includes(value), false, 'provider metadata must not leak credentials');
  }
}

const all = listProviderConfigs(configuredEnv);
assert.deepEqual(all.map((item) => item.id), ids, 'provider registry order must be stable');
assert.equal(all.every((item) => item.status === 'CONFIGURED_UNTESTED'), true);
console.log('Provider configuration tests: PASS');