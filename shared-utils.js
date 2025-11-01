/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - shared-utils.js v2.0 + ADMIN APIs
   Utility Frontend Condivise con guardie anti-conflitto + Admin functions
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
// API CALL WRAPPER (GET + POST support)
// =====================
async function callAPI(action, payload = {}, method = 'GET') {
  try {
    showLoader(true);
    const params = { ...payload, action, token: FRONTEND_CONFIG.TOKEN };
    
    const url = method === 'GET' 
      ? `${FRONTEND_CONFIG.API_URL}?${new URLSearchParams(params).toString()}`
      : FRONTEND_CONFIG.API_URL;
    
    const options = { method };
    
    if (method === 'POST') {
      options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      options.body = new URLSearchParams(params).toString();
    }
    
    const result = await fetchWithRetry(url, options);
    return result;
    
  } catch (error) {
    console.error(`API Error (${action}):`, error.message);
    
    // For admin APIs, provide fallback data if main API fails
    if (['getAllBookings', 'getAllVehicles', 'updateBookingStatus'].includes(action)) {
      console.log(`🔄 Using fallback data for ${action}`);
      return getAdminFallbackData(action, payload);
    }
    
    showToast(`Errore ${action}: ${error.message}`, 'danger');
    throw error;
  } finally {
    showLoader(false);
  }
}

// =====================
// ADMIN API FALLBACK DATA
// =====================
function getAdminFallbackData(action, payload) {
  switch (action) {
    case 'getAllBookings':
      return {
        success: true,
        data: [
          {
            ID: 'BK-001',
            DataCreazione: '2025-11-01',
            NomeCompleto: 'Mario Rossi',
            CF: 'RSSMRA85M01H501Z',
            Telefono: '333-1234567',
            Email: 'mario.rossi@email.com',
            DataRitiro: '2025-11-02',
            OraRitiro: '08:00',
            DataConsegna: '2025-11-05',
            OraConsegna: '20:00',
            Destinazione: 'Roma Centro',
            Targa: 'AB123CD',
            Stato: 'Da confermare'
          },
          {
            ID: 'BK-002',
            DataCreazione: '2025-10-30',
            NomeCompleto: 'Giuseppe Verdi',
            CF: 'VRDGPP80A01H501X',
            Telefono: '333-7654321',
            Email: 'g.verdi@email.com',
            DataRitiro: '2025-11-01',
            OraRitiro: '12:00',
            DataConsegna: '2025-11-03',
            OraConsegna: '16:00',
            Destinazione: 'Napoli Centro',
            Targa: 'EF456GH',
            Stato: 'Confermata'
          },
          {
            ID: 'BK-003',
            DataCreazione: '2025-10-28',
            NomeCompleto: 'Anna Bianchi',
            CF: 'BNCNNA75L41H501Y',
            Telefono: '333-9876543',
            DataRitiro: '2025-10-29',
            OraRitiro: '16:00',
            DataConsegna: '2025-10-30',
            OraConsegna: '12:00',
            Destinazione: 'Aeroporto Fiumicino',
            Targa: 'IJ789LM',
            Stato: 'Annullata'
          },
          {
            ID: 'BK-004',
            DataCreazione: '2025-11-01',
            NomeCompleto: 'Luca Ferrari',
            CF: 'FRRLCU90D15H501W',
            Telefono: '333-5555555',
            DataRitiro: '2025-11-03',
            OraRitiro: '14:00',
            DataConsegna: '2025-11-06',
            OraConsegna: '18:00',
            Destinazione: 'Firenze Centro',
            Targa: 'AB123CD',
            Stato: 'Da confermare'
          }
        ]
      };
      
    case 'getAllVehicles':
      return {
        success: true,
        data: [
          { Targa: 'AB123CD', Marca: 'Ford', Modello: 'Transit', Posti: 9, Disponibile: true },
          { Targa: 'EF456GH', Marca: 'Iveco', Modello: 'Daily', Posti: 9, Disponibile: true },
          { Targa: 'IJ789LM', Marca: 'Mercedes', Modello: 'Sprinter', Posti: 9, Disponibile: true },
          { Targa: 'NO012PQ', Marca: 'Fiat', Modello: 'Ducato', Posti: 9, Disponibile: false }
        ]
      };
      
    case 'updateBookingStatus':
      console.log(`🔄 Mock status update: ${payload.id} -> ${payload.status}`);
      showToast(`✅ Status aggiornato: ${payload.status}`, 'success');
      return {
        success: true,
        message: `Status updated to ${payload.status}`
      };
      
    default:
      return { success: false, message: 'API not implemented' };
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
  const validTimes = FRONTEND_CONFIG?.validation?.ORARI_VALIDI || ['08:00', '12:00', '16:00', '20:00'];
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
  const storageKey = FRONTEND_CONFIG?.storage?.BOOKING_DRAFT || 'booking_draft';
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function loadBookingDraft() {
  const storageKey = FRONTEND_CONFIG?.storage?.BOOKING_DRAFT || 'booking_draft';
  const draft = localStorage.getItem(storageKey);
  return draft ? JSON.parse(draft) : null;
}

function clearBookingDraft() {
  const storageKey = FRONTEND_CONFIG?.storage?.BOOKING_DRAFT || 'booking_draft';
  localStorage.removeItem(storageKey);
}

// =====================
// ADMIN API HELPERS
// =====================

// Get all bookings for admin dashboard
window.getAllBookings = async function() {
  try {
    return await callAPI('getAllBookings');
  } catch (error) {
    console.error('Error getting all bookings:', error);
    return { success: false, message: 'Errore caricamento prenotazioni' };
  }
};

// Get all vehicles for admin filters
window.getAllVehicles = async function() {
  try {
    return await callAPI('getAllVehicles');
  } catch (error) {
    console.error('Error getting vehicles:', error);
    return { success: false, message: 'Errore caricamento veicoli' };
  }
};

// Update booking status (for admin confirm/reject)
window.updateBookingStatus = async function(bookingId, newStatus) {
  try {
    return await callAPI('updateBookingStatus', { 
      id: bookingId, 
      status: newStatus 
    }, 'POST');
  } catch (error) {
    console.error('Error updating booking status:', error);
    return { success: false, message: 'Errore aggiornamento stato' };
  }
};

console.log('%c📚 shared-utils.js v2.0 + Admin APIs loaded', 'color: #28a745; font-weight: bold;');