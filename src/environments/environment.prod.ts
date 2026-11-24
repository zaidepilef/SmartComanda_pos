// Production configuration.
// Values are read at runtime from window.__env (env.js, generated from the
// container environment in Dokploy). If a value is missing, the default below is used.

interface RuntimeEnv {
  apiUrl?: string;
  turnstileSiteKey?: string;
  publicUrl?: string;
}

const runtimeEnv: RuntimeEnv = (globalThis as { __env?: RuntimeEnv }).__env ?? {};

function fromRuntime(value: string | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value.trim() : fallback;
}

export const environment = {
  production: true,
  apiUrl: fromRuntime(runtimeEnv.apiUrl, 'https://api.smartcomanda.online'),
  turnstileSiteKey: fromRuntime(runtimeEnv.turnstileSiteKey, '1x00000000000000000000AA'),
  publicUrl: fromRuntime(runtimeEnv.publicUrl, 'https://smartcomanda.online/frontend-client'),
};
