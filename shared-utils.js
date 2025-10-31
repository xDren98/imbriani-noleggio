/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - shared-utils.js v1.1 - Safe globals
   Utility Frontend Condivise con guardie anti-conflitto
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// =====================
// SAFE GLOBAL HELPERS (evita ridichiarazioni)
// =====================
window.qsId = window.qsId || function(id) { return document.getElementById(id); };
window.isValidCF = window.isValidCF || function(cf) {
  const cfUpper = String(cf || '').toUpperCase().trim();
  return cfUpper.length === 16 && /^[A-Z0-9]+$/.test(cfUpper);
};

// =====================
// FETCH WITH RETRY
// =====================
async function fetchWithRetry(url, options = {}, retries = 3) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry ${4-retries}/3 for ${url}:`, error.message);
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// =====================
// API CALL WRAPPER (GET-only)
// =====================
async function callAPI(action, payload = {}) {
  try {
    showLoader(true);
    const params = { ...payload, action, token: FRONTEND_CONFIG.TOKEN };
    const url = `${FRONTEND_CONFIG.API_URL}?${new URLSearchParams(params).toString()}`;
    const result = await fetchWithRetry(url, { method: 'GET' });
    return result;
  } catch (error) {
    console.error(`API Error (${action}):`, error.message);
    showToast(`Errore ${action}: ${error.message}`, 'danger');
    throw error;
  } finally {
    showLoader(false);
  }
}

// =====================
// UI HELPERS
// =====================
window.showLoader = window.showLoader || function(show = true) {
  const loader = qsId('loading-overlay');
  if (loader) loader.classList.toggle('hidden', !show);
};

window.showToast = window.showToast || function(message, type = 'info', duration = 3000) {
  const container = qsId('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${getToastIcon(type)} ${message}`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

function getToastIcon(type) {
  const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
  return icons[type] || 'ℹ️';
}

// =====================
// DATE HELPERS
// =====================
function formattaDataIT(dateObj) {
  if (!dateObj) return '';
  if (typeof dateObj === 'string') {
    const match = dateObj.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return dateObj;
  }
  const d = new Date(dateObj);
  return d.toLocaleDateString('it-IT');
}

function getNextValidTime() {
  const now = new Date();
  const validTimes = FRONTEND_CONFIG.validation.ORARI_VALIDI;
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  
  for (const time of validTimes) {
    if (time > currentTime) return time;
  }
  return validTimes[0]; // Domani
}

function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// =====================
// STORAGE HELPERS
// =====================
function saveBookingDraft(data) {
  localStorage.setItem(FRONTEND_CONFIG.storage.BOOKING_DRAFT, JSON.stringify(data));
}

function loadBookingDraft() {
  const draft = localStorage.getItem(FRONTEND_CONFIG.storage.BOOKING_DRAFT);
  return draft ? JSON.parse(draft) : null;
}

function clearBookingDraft() {
  localStorage.removeItem(FRONTEND_CONFIG.storage.BOOKING_DRAFT);
}

console.log('%c📚 shared-utils.js v1.1 loaded', 'color: #28a745; font-weight: bold;');
