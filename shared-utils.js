/* ================================================================================
   IMBRIANI NOLEGGIO - SHARED UTILITIES v8.0 (Enhanced Pro)
   Complete API management, validation, caching, and admin coordination
   ================================================================================ */

'use strict';

console.log('🔧 Shared Utils v8.0 loading...');

// =====================
// GLOBAL CONFIGURATION
// =====================
window.FRONTEND_CONFIG = window.FRONTEND_CONFIG || {
  API_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  TOKEN: 'imbriani_secret_2025',
  VERSION: '8.0.0',
  THEME: 'anthracite-azure',
  validation: {
    ORARI_VALIDI: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
  },
  storage: {
    USER_SESSION: 'imbriani_user_session',
    BOOKING_DRAFT: 'imbriani_booking_draft',
    ADMIN_CACHE: 'imbriani_admin_cache'
  }
};

// =====================
// ENHANCED API MANAGEMENT
// =====================
class APIManager {
  constructor() {
    this.baseUrl = FRONTEND_CONFIG.API_URL;
    this.timeout = 30000;
    this.retries = 3;
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 minutes
  }
  
  async call(endpoint, method = 'GET', data = null, options = {}) {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;
    
    // Check cache for GET requests
    if (method === 'GET' && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        console.log(`📦 Cache hit: ${endpoint}`);
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }
    
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers
      },
      ...options
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }
    
    let lastError;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        console.log(`📡 API Call [${attempt}/${this.retries}]: ${method} ${endpoint}`);
        
        const response = await this.fetchWithTimeout(this.baseUrl + endpoint, config);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Cache GET responses
        if (method === 'GET' && result.success) {
          this.cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
        }
        
        console.log(`✅ API Success: ${endpoint}`);
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ API Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retries) {
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }
    
    console.error(`❌ API Failed after all retries: ${endpoint}`, lastError);
    throw lastError;
  }
  
  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  clearCache() {
    this.cache.clear();
    console.log('🗑️ API cache cleared');
  }
}

// Global API instance
window.apiManager = new APIManager();

// =====================
// VALIDATION UTILITIES
// =====================
class Validator {
  static codiceFiscale(cf) {
    if (!cf || typeof cf !== 'string') return false;
    
    const cleaned = cf.toUpperCase().trim();
    if (cleaned.length !== 16) return false;
    
    const cfRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
    return cfRegex.test(cleaned);
  }
  
  static email(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
  
  static phone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    const phoneRegex = /^[+]?[0-9]{8,15}$/;
    return phoneRegex.test(cleaned);
  }
  
  static targa(targa) {
    if (!targa || typeof targa !== 'string') return false;
    const cleaned = targa.toUpperCase().replace(/\s+/g, '');
    const targaRegex = /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/;
    return targaRegex.test(cleaned);
  }
  
  static dateRange(startDate, endDate) {
    if (!startDate || !endDate) return false;
    return new Date(startDate) <= new Date(endDate);
  }
  
  static futureDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }
}

// =====================
// DATE UTILITIES
// =====================
class DateUtils {
  static format(date, locale = 'it-IT') {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString(locale);
    } catch {
      return '-';
    }
  }
  
  static formatDateTime(date, locale = 'it-IT') {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  }
  
  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
  
  static diffInDays(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((new Date(date2) - new Date(date1)) / oneDay);
  }
  
  static getTomorrowString() {
    return this.addDays(new Date(), 1).toISOString().split('T')[0];
  }
  
  static getWeekRange(date = new Date()) {
    const curr = new Date(date);
    const first = curr.getDate() - curr.getDay() + 1;
    const firstDay = new Date(curr.setDate(first));
    const lastDay = this.addDays(firstDay, 6);
    
    return { start: firstDay, end: lastDay };
  }
}

// =====================
// STRING UTILITIES
// =====================
class StringUtils {
  static capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  
  static capitalizeWords(str) {
    if (!str) return '';
    return str.split(' ').map(word => this.capitalize(word)).join(' ');
  }
  
  static truncate(str, length = 50, suffix = '...') {
    if (!str || str.length <= length) return str || '';
    return str.substring(0, length) + suffix;
  }
  
  static generateBookingId(prefix = 'BOOK') {
    const now = new Date();
    const year = now.getFullYear();
    const sequence = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `${prefix}-${year}-${sequence}`;
  }
  
  static cleanCF(cf) {
    if (!cf) return '';
    return cf.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}

// =====================
// TOAST NOTIFICATION SYSTEM
// =====================
class ToastManager {
  constructor() {
    this.container = this.getOrCreateContainer();
  }
  
  show(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;
    
    this.container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
    
    return toast;
  }
  
  success(message, duration) { return this.show(message, 'success', duration); }
  error(message, duration) { return this.show(message, 'error', duration); }
  warning(message, duration) { return this.show(message, 'warning', duration); }
  info(message, duration) { return this.show(message, 'info', duration); }
  
  getOrCreateContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }
}

// =====================
// DOM UTILITIES
// =====================
class DOMUtils {
  static ready(callback) {
    if (document.readyState !== 'loading') {
      callback();
    } else {
      document.addEventListener('DOMContentLoaded', callback);
    }
  }
  
  static show(selector) {
    const elements = typeof selector === 'string' ? 
      document.querySelectorAll(selector) : [selector];
    
    elements.forEach(el => {
      if (el) el.classList.remove('hidden');
    });
  }
  
  static hide(selector) {
    const elements = typeof selector === 'string' ? 
      document.querySelectorAll(selector) : [selector];
    
    elements.forEach(el => {
      if (el) el.classList.add('hidden');
    });
  }
  
  static toggle(selector, force = null) {
    const elements = typeof selector === 'string' ? 
      document.querySelectorAll(selector) : [selector];
    
    elements.forEach(el => {
      if (el) {
        if (force === null) {
          el.classList.toggle('hidden');
        } else {
          el.classList.toggle('hidden', !force);
        }
      }
    });
  }
}

// =====================
// EVENT UTILITIES
// =====================
class EventUtils {
  static debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  }
  
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  static once(func) {
    let called = false;
    return function(...args) {
      if (!called) {
        called = true;
        return func.apply(this, args);
      }
    };
  }
}

// =====================
// GLOBAL INSTANCES
// =====================
window.toastManager = new ToastManager();

// =====================
// LEGACY API FUNCTIONS (Backward Compatibility)
// =====================
async function callAPI(action, payload = {}, method = 'GET') {
  try {
    showLoader(true);
    
    // Mock data for demonstration
    if (action === 'getAllBookings') {
      await new Promise(r => setTimeout(r, 500)); // Simulate network delay
      return {
        success: true,
        data: [
          {
            ID: 'BOOK-2025-059',
            DataCreazione: '2025-10-03',
            NomeCompleto: 'Paolo Calasso',
            CF: 'CLSPLA83E06C978M',
            Telefono: '328702448',
            Email: 'paolo.calasso@email.it',
            Targa: 'DN391FW',
            DataRitiro: '2025-10-03',
            OraRitiro: '18:00',
            DataConsegna: '2025-10-06',
            OraConsegna: '10:00',
            Destinazione: 'Roma Centro',
            Stato: 'Da confermare',
            Note: 'Transfer aeroporto'
          },
          {
            ID: 'BOOK-2025-060',
            DataCreazione: '2025-10-03',
            NomeCompleto: 'Marco Bianchi',
            CF: 'BNCMRC82B15H501K',
            Telefono: '339123456',
            Email: 'marco.bianchi@email.it',
            Targa: 'DL291XZ',
            DataRitiro: '2025-10-04',
            OraRitiro: '17:00',
            DataConsegna: '2025-10-06',
            OraConsegna: '08:00',
            Destinazione: 'Ostia Lido',
            Stato: 'Confermata',
            Note: 'Cliente abituale'
          },
          {
            ID: 'BOOK-2025-061',
            DataCreazione: '2025-10-04',
            NomeCompleto: 'Daniel Vernich',
            CF: 'VRNDNL79F29FC842K',
            Telefono: '393367475',
            Email: 'daniel.vernich@gmail.com',
            Targa: 'EC787NM',
            DataRitiro: '2025-10-05',
            OraRitiro: '08:00',
            DataConsegna: '2025-10-05',
            OraConsegna: '20:00',
            Destinazione: 'Aeroporto Fiumicino',
            Stato: 'Da confermare',
            Note: 'Volo internazionale'
          },
          {
            ID: 'BOOK-2025-062',
            DataCreazione: '2025-10-02',
            NomeCompleto: 'Laura Rossi',
            CF: 'RSSLRA88D52H501Y',
            Telefono: '347789123',
            Email: 'laura.rossi@outlook.it',
            Targa: 'FG456HJ',
            DataRitiro: '2025-10-04',
            OraRitiro: '15:00',
            DataConsegna: '2025-10-06',
            OraConsegna: '18:00',
            Destinazione: 'Napoli',
            Stato: 'Annullata',
            Note: 'Cancellazione cliente'
          }
        ]
      };
    }
    
    if (action === 'getAllVehicles') {
      await new Promise(r => setTimeout(r, 300));
      return {
        success: true,
        data: [
          { Targa: 'DN391FW', Marca: 'Ford', Modello: 'Transit', Posti: 9, Disponibile: true },
          { Targa: 'DL291XZ', Marca: 'Iveco', Modello: 'Daily', Posti: 9, Disponibile: true },
          { Targa: 'EC787NM', Marca: 'Mercedes', Modello: 'Sprinter', Posti: 9, Disponibile: true },
          { Targa: 'FG456HJ', Marca: 'Fiat', Modello: 'Ducato', Posti: 9, Disponibile: false }
        ]
      };
    }
    
    if (action === 'updateBookingStatus') {
      await new Promise(r => setTimeout(r, 200));
      return {
        success: true,
        message: `Status aggiornato: ${payload.status}`
      };
    }
    
    // Login CF simulation
    if (action === 'loginWithCF') {
      await new Promise(r => setTimeout(r, 800));
      if (Validator.codiceFiscale(payload.cf)) {
        return {
          success: true,
          user: {
            cf: payload.cf,
            name: 'Cliente Demo',
            bookings: ['BOOK-2025-059', 'BOOK-2025-061']
          }
        };
      } else {
        return {
          success: false,
          message: 'Codice fiscale non valido'
        };
      }
    }
    
    // Default fallback
    return {
      success: false,
      message: `API action '${action}' not implemented in demo mode`
    };
    
  } catch (error) {
    console.error(`API Error (${action}):`, error);
    showToast(`Errore ${action}: ${error.message}`, 'error');
    throw error;
  } finally {
    showLoader(false);
  }
}

// =====================
// UI HELPER FUNCTIONS
// =====================
function showLoader(show = true) {
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.classList.toggle('hidden', !show);
  }
}

function showToast(message, type = 'info', duration = 4000) {
  return window.toastManager.show(message, type, duration);
}

// Specific toast shortcuts
function showSuccess(message, duration) {
  return showToast(message, 'success', duration);
}

function showError(message, duration) {
  return showToast(message, 'error', duration);
}

function showWarning(message, duration) {
  return showToast(message, 'warning', duration);
}

function showInfo(message, duration) {
  return showToast(message, 'info', duration);
}

// =====================
// FORM UTILITIES
// =====================
function validateForm(formElement) {
  const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
  let isValid = true;
  
  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('error');
      isValid = false;
    } else {
      input.classList.remove('error');
    }
  });
  
  return isValid;
}

function clearForm(formElement) {
  const inputs = formElement.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.value = '';
    input.classList.remove('error');
  });
}

// =====================
// SESSION MANAGEMENT
// =====================
function saveUserSession(userData) {
  localStorage.setItem(FRONTEND_CONFIG.storage.USER_SESSION, JSON.stringify({
    ...userData,
    timestamp: Date.now()
  }));
}

function getUserSession() {
  try {
    const session = localStorage.getItem(FRONTEND_CONFIG.storage.USER_SESSION);
    if (!session) return null;
    
    const data = JSON.parse(session);
    
    // Check if session is still valid (24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > maxAge) {
      clearUserSession();
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

function clearUserSession() {
  localStorage.removeItem(FRONTEND_CONFIG.storage.USER_SESSION);
}

// =====================
// BACKWARD COMPATIBILITY ALIASES
// =====================
window.validateCF = Validator.codiceFiscale;
window.formatDate = DateUtils.format;
window.formatDateTime = DateUtils.formatDateTime;
window.isValidEmail = Validator.email;
window.isValidPhone = Validator.phone;
window.debounce = EventUtils.debounce;
window.throttle = EventUtils.throttle;

// DOM helpers
window.qsId = (id) => document.getElementById(id);
window.qs = (selector) => document.querySelector(selector);
window.qsAll = (selector) => document.querySelectorAll(selector);

// Show/hide helpers
window.showElement = DOMUtils.show;
window.hideElement = DOMUtils.hide;
window.toggleElement = DOMUtils.toggle;

// Export class utilities for advanced usage
window.ImbrianiUtils = {
  Validator,
  DateUtils,
  StringUtils,
  DOMUtils,
  EventUtils,
  APIManager,
  ToastManager
};

console.log(`%c✅ Shared Utils v8.0 loaded successfully! (${FRONTEND_CONFIG.THEME})`, 'color: #22c55e; font-weight: bold;');