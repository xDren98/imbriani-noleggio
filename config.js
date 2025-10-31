window.APP_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbx8vOsfdliS4e5odoRMkvCwaWY7SowSkgtW0zTuvqDIu4R99sUEixlLSW7Y9MyvNWk/exec',
  AUTH_TOKEN: 'imbriani_secret_2025'
};

async function callAPI(params) {
  const url = new URL(window.APP_CONFIG.GAS_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  // get to avoid CORS preflight
  const res = await fetch(url.toString(), { method: 'GET' });
  return res.json();
}