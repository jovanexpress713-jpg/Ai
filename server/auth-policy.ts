export type AuthEnvironment = {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  FORGEX_ADMIN_EMAIL?: string;
  FORGEX_ADMIN_PASSWORD?: string;
};

export function isProductionAuthConfigured(env: AuthEnvironment = process.env): boolean {
  if (env.NODE_ENV !== 'production') return true;
  const email = String(env.FORGEX_ADMIN_EMAIL || '').trim();
  const password = String(env.FORGEX_ADMIN_PASSWORD || '');
  return email.length > 0 && password.length >= 16;
}

export function shouldUseDevelopmentFallback(env: AuthEnvironment = process.env): boolean {
  return env.NODE_ENV !== 'production';
}
