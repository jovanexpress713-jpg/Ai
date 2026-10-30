import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const port = 4317;
const baseUrl = `http://127.0.0.1:${port}`;
const dbPath = path.resolve(process.cwd(), 'data/forgex_db.json');
const dbBackup = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;

const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    OPENROUTER_API_KEY: '',
    OLLAMA_BASE_URL: '',
    OLLAMA_MODEL: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status === 200 || response.status === 401 || response.status === 503) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready.\n${logs}`);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

try {
  await waitForServer();

  const session = await request('/api/auth/session');
  if (session.response.status !== 200 || session.body.authenticated !== true) {
    throw new Error(`Development session fallback failed: ${session.response.status} ${JSON.stringify(session.body)}`);
  }

  const health = await request('/api/health');
  if (health.response.status !== 200 || health.body.services?.gemini?.status !== 'not_configured') {
    throw new Error(`Health/Gemini status failed: ${health.response.status} ${JSON.stringify(health.body)}`);
  }

  const providers = await request('/api/ai/providers');
  if (providers.response.status !== 200 || providers.body.success !== true || providers.body.providers?.length !== 5) {
    throw new Error(`AI provider diagnostics failed: ${providers.response.status} ${JSON.stringify(providers.body)}`);
  }
  if (JSON.stringify(providers.body).includes('secret') || providers.body.providers.some((provider) => provider.status !== 'NOT_CONFIGURED')) {
    throw new Error(`Provider diagnostics exposed unsafe or inaccurate metadata: ${JSON.stringify(providers.body)}`);
  }

  const providerTest = await request('/api/ai/providers/anthropic/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (providerTest.response.status !== 400 || providerTest.body.status !== 'NOT_CONFIGURED') {
    throw new Error(`Anthropic unavailable-state failed: ${providerTest.response.status} ${JSON.stringify(providerTest.body)}`);
  }

  const gemini = await request('/api/gemini/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (gemini.response.status !== 400 || gemini.body.status !== 'Not Configured') {
    throw new Error(`Gemini unavailable-state failed: ${gemini.response.status} ${JSON.stringify(gemini.body)}`);
  }

  const agent = await request('/api/agent/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Smoke test: verify the autonomous engineering route is connected.' }),
  });
  if (agent.response.status !== 200 || agent.body.success !== true || agent.body.task?.state !== 'FAILED' || !String(agent.body.task?.error || '').includes('No AI provider is configured')) {
    throw new Error(`Agent route failed: ${agent.response.status} ${JSON.stringify(agent.body)}`);
  }

  console.log('Runtime smoke test: PASS');
} finally {
  if (dbBackup) fs.writeFileSync(dbPath, dbBackup);
  else fs.rmSync(dbPath, { force: true });
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 300));
}
