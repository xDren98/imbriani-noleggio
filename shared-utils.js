/*
  IMBRIANI NOLEGGIO - shared-utils.js v1.0
  Utility Frontend Condivise (scripts.js + admin.js)
*/

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
async function callAPI(action, payload = {}, method = 'POST') {
    try {
        showLoader(true);
        
        const params = {
            ...payload,
            action,
            token: FRONTEND_CONFIG.TOKEN
        };
        
        const url = method === 'GET' ? 
            FRONTEND_CONFIG.API_URL + '?' + new URLSearchParams(params).toString() :
            FRONTEND_CONFIG.API_URL;
            
        const options = {
            method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        
        if (method === 'POST') {
            options.body = new URLSearchParams(params).toString();
        }
        
        const result = await fetchWithRetry(url, options);
        showLoader(false);
        return result;
        
    } catch (error) {
        showLoader(false);
        Logger.error('API Error:', action, error.message);
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
    toast.innerHTML = `<span>${message}</span>`;
    
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
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

// =====================
// MODAL HELPERS
// =====================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

// =====================
// DATE FORMATTING
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
    const match = String(oraStr).match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '08:00';
}

function formattaPeriodo(dataInizio, dataFine, oraInizio, oraFine) {
    return `${formattaDataIT(dataInizio)} ${formattaOra(oraInizio)} → ${formattaDataIT(dataFine)} ${formattaOra(oraFine)}`;
}

// =====================
// CF VALIDATION
// =====================
function isValidCF(cf) {
    const cfUpper = String(cf).toUpperCase().trim();
    if (cfUpper.length !== 16) return false;
    return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(cfUpper);
}

function formatCF(cf) {
    return String(cf).toUpperCase().trim();
}

// =====================
// DOM HELPERS
// =====================
function qs(selector) {
    return document.querySelector(selector);
}

function qsAll(selector) {
    return document.querySelectorAll(selector);
}

function qsId(id) {
    return document.getElementById(id);
}

function showElement(elem, show = true) {
    if (elem) {
        elem.classList.toggle('hidden', !show);
    }
}

function isVisible(elem) {
    return elem && !elem.classList.contains('hidden');
}

// =====================
// STATE HELPERS
// =====================
function getStatoEmoji(stato) {
    const config = STATE_LABELS[stato] || STATE_LABELS['Da confermare'];
    return config.emoji;
}

function getStatoColor(stato) {
    const config = STATE_LABELS[stato] || STATE_LABELS['Da confermare'];
    return config.color;
}

function getStatoLabel(stato) {
    const config = STATE_LABELS[stato] || STATE_LABELS['Da confermare'];
    return config.label;
}

// =====================
// CALCULATION HELPERS
// =====================
function calcolaGiorni(dataInizio, dataFine) {
    const inizio = new Date(dataInizio);
    const fine = new Date(dataFine);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((fine - inizio) / msPerDay) + 1;
}

function calcolaImporto(dataInizio, dataFine, tariffaGiorno) {
    const giorni = calcolaGiorni(dataInizio, dataFine);
    return Math.round(giorni * tariffaGiorno * 100) / 100;
}

// =====================
// CSV EXPORT
// =====================
function downloadCSV(data, filename = 'export.csv') {
    let csv = '';
    
    if (Array.isArray(data) && data.length > 0) {
        const keys = Object.keys(data[0]);
        csv += keys.map(k => `"${k}"`).join(',') + '\n';
        
        for (const row of data) {
            csv += keys.map(k => `"${row[k] || ''}"`).join(',') + '\n';
        }
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// =====================
// STORAGE HELPERS
// =====================
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('Storage error:', e.message);
    }
}

function getFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.warn('Storage error:', e.message);
        return defaultValue;
    }
}

function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn('Storage error:', e.message);
    }
}

// =====================
// STRING HELPERS
// =====================
function maskCF(cf) {
    if (!cf || cf.length < 10) return '***';
    return cf.substring(0, 3) + '***' + cf.substring(cf.length - 4);
}

function maskNome(nome) {
    if (!nome) return '';
    const words = nome.trim().split(' ');
    return words.map(w => w.length > 3 ? w.substring(0, 3) + '***' : w).join(' ');
}

console.log('%c✅ shared-utils.js caricato', 'color: #28a745; font-weight: bold;');