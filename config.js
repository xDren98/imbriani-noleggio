window.APP_CONFIG = {
  GAS_URL: '', // es: https://script.google.com/macros/s/DEPLOYMENT_ID/exec
  AUTH_TOKEN: 'imbriani_secret_2025'
};

async function callAPI(params) {
  const url = new URL(window.APP_CONFIG.GAS_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  // get to avoid CORS preflight
  const res = await fetch(url.toString(), { method: 'GET' });
  return res.json();
}
