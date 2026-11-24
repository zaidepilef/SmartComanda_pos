// Runtime configuration, generated at container start by 40-runtime-env.sh.
// Values come from the container environment (Dokploy → Environment).
// Everything here is PUBLIC (visible in the browser): never put secrets here.
window.__env = {
  apiUrl: '${API_URL}',
  turnstileSiteKey: '${TURNSTILE_SITE_KEY}',
  publicUrl: '${PUBLIC_URL}',
};
