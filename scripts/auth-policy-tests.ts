import assert from 'node:assert/strict';
import { isProductionAuthConfigured, shouldUseDevelopmentFallback } from '../server/auth-policy.ts';

assert.equal(
  isProductionAuthConfigured({ NODE_ENV: 'production', FORGEX_ADMIN_EMAIL: 'admin@example.com', FORGEX_ADMIN_PASSWORD: '' }),
  false,
  'production must reject missing password'
);
assert.equal(
  isProductionAuthConfigured({ NODE_ENV: 'production', FORGEX_ADMIN_EMAIL: 'admin@example.com', FORGEX_ADMIN_PASSWORD: 'short' }),
  false,
  'production must reject weak password'
);
assert.equal(
  isProductionAuthConfigured({ NODE_ENV: 'production', FORGEX_ADMIN_EMAIL: '', FORGEX_ADMIN_PASSWORD: '1234567890123456' }),
  false,
  'production must require admin email'
);
assert.equal(
  isProductionAuthConfigured({ NODE_ENV: 'production', FORGEX_ADMIN_EMAIL: 'admin@example.com', FORGEX_ADMIN_PASSWORD: '1234567890123456' }),
  true,
  'production accepts a configured strong credential pair'
);
assert.equal(
  shouldUseDevelopmentFallback({ NODE_ENV: 'development', FORGEX_ADMIN_EMAIL: '', FORGEX_ADMIN_PASSWORD: '' }),
  true,
  'development may use the local fallback'
);
assert.equal(
  shouldUseDevelopmentFallback({ NODE_ENV: 'production', FORGEX_ADMIN_EMAIL: '', FORGEX_ADMIN_PASSWORD: '' }),
  false,
  'production must never use the local fallback'
);

console.log('Auth policy tests: PASS');
