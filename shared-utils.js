/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - shared-utils.js v1.0
   Utility Frontend Condivise (scripts.js + admin.js)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// =====================
// FETCH WITH RETRY
// =====================
async function fetchWithRetry(url, options = {}, retries = 3) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// =====================
// API CALL WRAPPER
// =====================
async function callAPI(action, payload = {}, method = 'GET') {
  try {
    showLoader(true);
    const params = { ...payload, action, token: FRONTEND_CONFIG.TOKEN };
    const url = `${FRONTEND_CONFIG.API_URL}?${new URLSearchParams(params).toString()}`;
    const options = { method: 'GET' };
    const result = await fetchWithRetry(url, options);
    showLoader(false);
    return result;
  } catch (error) {
    showLoader(false);
    console.error(`API Error (${action}): ${error.message}`);
    throw error;
  }
}

// =====================
// TOAST NOTIFICATIONS
// =====================
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// =====================
// LOADER
// =====================
function showLoader(show = true) {
  const loader = document.getElementById('loading-overlay');
  if (loader) loader.classList.toggle('hidden', !show);
}

// =====================
// DATE + STRING HELPERS (estratto)
// =====================
function formattaDataIT(dateObj) {
  if (!dateObj) return '';
  if (typeof dateObj === 'string') {
    const match = dateObj.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return dateObj;
  }
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formattaOra(oraStr) {
  const match = String(oraStr || '').match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '08:00';
}

function isValidCF(cf) {
  const cfUpper = String(cf || '').toUpperCase().trim();
  if (cfUpper.length !== 16) return false;
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cfUpper);
}

function qsId(id) { return document.getElementById(id); }

console.log('%c📚 shared-utils.js caricato', 'color: #28a745; font-weight: bold;');
