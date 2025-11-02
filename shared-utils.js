// Shared utilities aligned with backend API actions
'use strict';

window.qsId = function(id) { return document.getElementById(id); };

window.isValidCF = function(cf) {
  const cfUpper = String(cf || '').toUpperCase().trim();
  return cfUpper.length === 16 && /^[A-Z0-9]+$/.test(cfUpper);
};

window.showLoader = function(show = true) {
  const loader = qsId('loading-overlay');
  if (loader) loader.classList.toggle('hidden', !show);
};

window.showToast = function(message, type = 'info', duration = 3000) {
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
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  return icons[type] || 'ℹ️';
}

// API call wrapper aligned with backend actions
window.callAPI = async function(action, payload = {}) {
  const params = { ...payload, action, token: FRONTEND_CONFIG.TOKEN };
  const url = `${FRONTEND_CONFIG.API_URL}?${new URLSearchParams(params).toString()}`;
  
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: error.message };
  }
};

window.formattaDataIT = function(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

console.log('✅ shared-utils.js loaded');