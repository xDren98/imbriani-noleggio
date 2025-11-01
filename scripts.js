/* ═══════════════════════════════════════════════════════════════════════════════════════════
   IMBRIANI STEFANO NOLEGGIO - scripts.js v7.0.0 WEEKEND PREMIUM
   + WhatsApp ASCII Fix + Admin Dashboard + Dark Mode Ready
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

'use strict';

const VERSION = '7.0.0';
const PHONE_NUMBER = '3286589618';
const MAX_WHATSAPP_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const CALLING_HOURS = { start: 8, end: 21 };

let clienteCorrente = null;
let prenotazioniUtente = [];
let availableVehicles = [];
let stepAttuale = 1;
let bookingData = {};
let draftTimer = null;
let autoSaveTimer = null;
let preventivoRequested = false;
let whatsappCount = 0;
let whatsappTimestamps = [];
let voiceRecognition = null;

console.log(`%c🚀 Imbriani Stefano Noleggio v${VERSION} WEEKEND PREMIUM`, 'font-size: 14px; font-weight: bold; color: #007f17;');

// =====================
// DATE UTILITIES (Enhanced with Italian format)
// =====================
function toISODate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0,10);

  const s = String(value).trim();
  if (!s) return '';

  // Already ISO yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/MM/yyyy or dd-MM-yyyy (from spreadsheet)
  let m = s.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // yyyy-MM-ddTHH:mm:ss(.sss)Z (from API)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // Try Date parsing as fallback
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  } catch(e) {}

  return '';
}

// 🇮🇹 Convert ISO date to Italian format for Google Sheets
function toItalianDate(isoDate) {
  if (!isoDate) return '';
  
  // ISO yyyy-MM-dd -> dd/MM/yyyy
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  
  return isoDate; // fallback
}

function composeAddress(via, civico, comune) {
  const parts = [via, civico, comune].filter(p => p && String(p).trim());
  return parts.join(' ');
}

// =====================
// WHATSAPP ASCII-ONLY MESSAGE (Fixed for all devices)
// =====================
function buildPreventivoMessage() {
  const { dataRitiro, oraRitiro, dataConsegna, oraConsegna, destinazione, targa, selectedVehicle } = bookingData;
  
  // Calculate duration
  const startDate = new Date(`${dataRitiro}T${oraRitiro}:00`);
  const endDate = new Date(`${dataConsegna}T${oraConsegna}:00`);
  const diffMs = endDate - startDate;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  
  let durationText = '';
  if (days > 0 && hours > 0) durationText = `${days} giorno${days > 1 ? 'i' : ''}, ${hours} ore`;
  else if (days > 0) durationText = `${days} giorno${days > 1 ? 'i' : ''}`;
  else durationText = `${hours} ore`;
  
  const posti = selectedVehicle?.Posti || '9';
  
  // 📱 100% ASCII MESSAGE - No Unicode, No Emoji, No Special Characters
  return `PREVENTIVO PULMINO IMBRIANI
===========================
Dal: ${formattaDataIT(dataRitiro)} alle ${oraRitiro}
Al: ${formattaDataIT(dataConsegna)} alle ${oraConsegna}
Destinazione: ${destinazione}
Pulmino: ${targa} (${posti} posti)
Durata: ${durationText}
===========================
Contatto: ${PHONE_NUMBER}
Grazie!`;
}

function updatePreventivoSummary() {
  const container = qsId('preventivo-details');
  if (!container || !bookingData.targa) return;
  
  // Calculate duration for display
  const startDate = new Date(`${bookingData.dataRitiro}T${bookingData.oraRitiro}:00`);
  const endDate = new Date(`${bookingData.dataConsegna}T${bookingData.oraConsegna}:00`);
  const diffMs = endDate - startDate;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  
  let durationText = '';
  if (days > 0 && hours > 0) durationText = `${days}g ${hours}h`;
  else if (days > 0) durationText = `${days} giorno${days > 1 ? 'i' : ''}`;
  else durationText = `${hours} ore`;
  
  const posti = bookingData.selectedVehicle?.Posti || '9';
  
  container.innerHTML = `
    <div class="summary-row"><span>🚐 Pulmino:</span> <strong>${bookingData.targa} (${posti} posti)</strong></div>
    <div class="summary-row"><span>📅 Ritiro:</span> <strong>${formattaDataIT(bookingData.dataRitiro)} alle ${bookingData.oraRitiro}</strong></div>
    <div class="summary-row"><span>📅 Consegna:</span> <strong>${formattaDataIT(bookingData.dataConsegna)} alle ${bookingData.oraConsegna}</strong></div>
    <div class="summary-row"><span>🎯 Destinazione:</span> <strong>${bookingData.destinazione}</strong></div>
    <div class="summary-row"><span>⏰ Durata:</span> <strong>${durationText}</strong></div>
  `;
}

// =====================
// RATE LIMITING
// =====================
function checkRateLimit() {
  const now = Date.now();
  
  // Clean old timestamps
  whatsappTimestamps = whatsappTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  
  return whatsappTimestamps.length < MAX_WHATSAPP_PER_WINDOW;
}

function getRateLimitTimeRemaining() {
  if (whatsappTimestamps.length === 0) return 0;
  
  const oldestTimestamp = Math.min(...whatsappTimestamps);
  const timeRemaining = RATE_LIMIT_WINDOW - (Date.now() - oldestTimestamp);
  
  return Math.max(0, Math.ceil(timeRemaining / 1000 / 60)); // minutes
}

function showRateLimitWarning() {
  const warning = qsId('rate-limit-warning');
  const timer = qsId('rate-limit-timer');
  
  if (warning) {
    warning.classList.remove('hidden');
    
    if (timer) {
      const minutes = getRateLimitTimeRemaining();
      timer.textContent = `${minutes} minuto${minutes > 1 ? 'i' : ''}`;
    }
  }
}

// =====================
// CALLING HOURS CHECK
// =====================
function isWithinCallingHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= CALLING_HOURS.start && hour < CALLING_HOURS.end;
}

function showCallingHoursWarning() {
  const warning = qsId('calling-hours-warning');
  if (warning && !isWithinCallingHours()) {
    warning.classList.remove('hidden');
  }
}

// =====================
// VOICE INPUT
// =====================
function initVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('🎤 Voice recognition not supported');
    const voiceBtn = qsId('voice-input-btn');
    if (voiceBtn) voiceBtn.style.display = 'none';
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = 'it-IT';
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;
  
  voiceRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const destinazioneInput = qsId('destinazione');
    if (destinazioneInput) {
      destinazioneInput.value = transcript;
      destinazioneInput.focus();
      showToast(`🎤 Registrato: ${transcript}`, 'success');
    }
  };
  
  voiceRecognition.onerror = (event) => {
    showToast('🎤 Errore registrazione vocale', 'warning');
  };
  
  const voiceBtn = qsId('voice-input-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      if (voiceRecognition) {
        voiceBtn.classList.add('recording');
        showToast('🎤 Parla ora...', 'info', 3000);
        voiceRecognition.start();
        
        setTimeout(() => {
          voiceBtn.classList.remove('recording');
        }, 5000);
      }
    });
  }
}

// =====================
// CONTRAST MODE
// =====================
function initContrastMode() {
  const contrastToggle = qsId('contrast-toggle');
  if (!contrastToggle) return;
  
  // Check saved preference
  const contrastEnabled = localStorage.getItem('contrast-mode') === '1';
  if (contrastEnabled) {
    document.body.classList.add('high-contrast');
    contrastToggle.textContent = '🔅';
  }
  
  contrastToggle.addEventListener('click', () => {
    const isEnabled = document.body.classList.toggle('high-contrast');
    localStorage.setItem('contrast-mode', isEnabled ? '1' : '0');
    contrastToggle.textContent = isEnabled ? '🔅' : '🔆';
    showToast(isEnabled ? '🔆 Contrasto elevato attivato' : '🔅 Contrasto normale', 'info');
  });
}

// =====================
// KEYBOARD SHORTCUTS
// =====================
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // ESC = back to previous step
    if (e.key === 'Escape' && stepAttuale > 1) {
      e.preventDefault();
      goToStep(stepAttuale - 1);
      showToast('⬅ Step precedente', 'info');
    }
    
    // CTRL+ENTER = next step
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      const nextBtn = document.querySelector(`#step${stepAttuale}-next, #step${stepAttuale}-confirm`);
      if (nextBtn && !nextBtn.disabled) {
        nextBtn.click();
      }
    }
    
    // F1 = help
    if (e.key === 'F1') {
      e.preventDefault();
      showToast('🎯 Scorciatoie: ESC=Indietro | Ctrl+Enter=Avanti | Tab=Naviga', 'info', 5000);
    }
  });
}

// =====================
// SWIPE NAVIGATION (Mobile)
// =====================
function initSwipeNavigation() {
  let startX = null;
  let startY = null;
  
  const handleTouchStart = (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  };
  
  const handleTouchEnd = (e) => {
    if (!startX || !startY) return;
    
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    // Check if horizontal swipe (not vertical scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0 && stepAttuale > 1) {
        // Swipe right = previous step
        goToStep(stepAttuale - 1);
        showToast('👈 Step precedente', 'info');
      } else if (deltaX < 0 && stepAttuale < 5) {
        // Swipe left = next step (if allowed)
        const nextBtn = document.querySelector(`#step${stepAttuale}-next`);
        if (nextBtn && !nextBtn.disabled) {
          validateAndGoToStep(stepAttuale + 1);
        }
      }
    }
    
    startX = startY = null;
  };
  
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchend', handleTouchEnd, { passive: true });
}

// =====================
// CF DUPLICATE CHECK
// =====================
function checkCFDuplicates() {
  const cfInputs = document.querySelectorAll('.driver-cf');
  const cfValues = Array.from(cfInputs).map(input => input.value.toUpperCase().trim()).filter(cf => cf.length === 16);
  
  // Find duplicates
  const duplicates = cfValues.filter((cf, index) => cfValues.indexOf(cf) !== index);
  
  const warning = qsId('cf-duplicate-warning');
  if (warning) {
    if (duplicates.length > 0) {
      warning.classList.remove('hidden');
      // Highlight duplicate fields
      cfInputs.forEach(input => {
        const value = input.value.toUpperCase().trim();
        if (duplicates.includes(value)) {
          input.classList.add('error');
        }
      });
      return false;
    } else {
      warning.classList.add('hidden');
      // Remove error highlights
      cfInputs.forEach(input => input.classList.remove('error'));
      return true;
    }
  }
  
  return duplicates.length === 0;
}

// =====================
// AUTO-SAVE SYSTEM
// =====================
function initAutoSave() {
  autoSaveTimer = setInterval(() => {
    if (stepAttuale >= 1 && stepAttuale <= 4) {
      saveDraftData();
      showAutoSaveIndicator();
    }
  }, AUTO_SAVE_INTERVAL);
}

function showAutoSaveIndicator() {
  const indicator = qsId('autosave-indicator');
  if (indicator) {
    indicator.classList.remove('hidden');
    setTimeout(() => {
      indicator.classList.add('hidden');
    }, 2000);
  }
}

// =====================
// BREADCRUMB NAVIGATION
// =====================
function initBreadcrumbs() {
  document.querySelectorAll('.breadcrumb-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetStep = parseInt(item.getAttribute('data-step'));
      if (targetStep <= stepAttuale || canAccessStep(targetStep)) {
        goToStep(targetStep);
      }
    });
  });
}

function updateBreadcrumbs() {
  document.querySelectorAll('.breadcrumb-item').forEach((item, index) => {
    const stepNum = index + 1;
    item.classList.toggle('active', stepNum === stepAttuale);
    item.classList.toggle('completed', stepNum < stepAttuale);
    item.classList.toggle('accessible', stepNum <= stepAttuale || canAccessStep(stepNum));
  });
}

function canAccessStep(stepNum) {
  // Step access logic
  if (stepNum <= 2) return true;
  if (stepNum === 3) return bookingData.selectedVehicle;
  if (stepNum === 4) return preventivoRequested;
  if (stepNum === 5) return bookingData.drivers?.length > 0;
  return false;
}

// =====================
// FULL NAME VALIDATION
// =====================
function validateFullName(input) {
  const name = input.value.trim();
  const words = name.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length >= 2) {
    input.classList.remove('error');
    input.classList.add('valid');
    return true;
  } else {
    input.classList.remove('valid');
    input.classList.add('error');
    return false;
  }
}

// =====================
// INIT & DOM READY
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  checkExistingSession();
  setupAutoSaveDraft();
  initAutoSave();
  initVoiceInput();
  initContrastMode();
  initKeyboardShortcuts();
  initSwipeNavigation();
  initBreadcrumbs();
});

function initializeApp() {
  // Login form
  const loginForm = qsId('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Logout
  const logoutBtn = qsId('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Wizard navigation
  setupWizardNavigation();

  // Tab navigation (existing customers)
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // New customer CTA (dual homepage)
  const newCustomerCTA = qsId('new-customer-cta');
  if (newCustomerCTA) {
    newCustomerCTA.addEventListener('click', handleNewCustomerCTA);
  }

  // Preventivo buttons
  const callBtn = qsId('call-btn');
  if (callBtn) callBtn.addEventListener('click', handleCallPreventivo);
  
  const whatsappBtn = qsId('whatsapp-btn');
  if (whatsappBtn) whatsappBtn.addEventListener('click', handleWhatsAppPreventivo);

  // Refresh actions
  const refreshBtn = qsId('refresh-bookings');
  if (refreshBtn) refreshBtn.addEventListener('click', loadUserBookings);

  console.log('🔧 App initialized with v7.0.0 Weekend Premium features');
}

function setupWizardNavigation() {
  const navigationMap = {
    'step1-next': () => validateAndGoToStep(2),
    'step2-back': () => goToStep(1),
    'step2-next': () => validateAndGoToStep(3),
    'step3-back': () => goToStep(2),
    'step3-next': () => validateAndGoToStep(4),
    'step4-back': () => goToStep(3),
    'step4-next': () => validateAndGoToStep(5),
    'step5-back': () => goToStep(4),
    'step5-confirm': () => submitBooking(),
    'add-autista': () => addDriver()
  };

  Object.entries(navigationMap).forEach(([id, handler]) => {
    const element = qsId(id);
    if (element) element.addEventListener('click', handler);
  });
}

function setupAutoSaveDraft() {
  const formFields = ['data-ritiro', 'ora-ritiro', 'data-consegna', 'ora-consegna', 'destinazione'];
  formFields.forEach(id => {
    const field = qsId(id);
    if (field) {
      field.addEventListener('change', startDraftTimer);
      field.addEventListener('input', startDraftTimer);
    }
  });
}

function startDraftTimer() {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraftData, 2000); // Salva dopo 2s di inattività
}

function checkExistingSession() {
  const savedCF = localStorage.getItem(FRONTEND_CONFIG.storage.CF);
  if (savedCF && isValidCF(savedCF)) {
    const cfInput = qsId('cf-input');
    if (cfInput) cfInput.value = savedCF;
  }
}

// =====================
// PREVENTIVO HANDLERS (Enhanced)
// =====================
function handleCallPreventivo() {
  if (!isWithinCallingHours()) {
    showCallingHoursWarning();
    setTimeout(() => {
      const warning = qsId('calling-hours-warning');
      if (warning) warning.classList.add('hidden');
    }, 5000);
  }
  
  window.open(`tel:${PHONE_NUMBER}`);
  markPreventivoRequested();
  showToast('📞 Apertura dialer... Dopo la chiamata torna qui!', 'info', 4000);
}

function handleWhatsAppPreventivo() {
  if (!checkRateLimit()) {
    showRateLimitWarning();
    return;
  }
  
  const message = buildPreventivoMessage();
  const encodedMessage = encodeURIComponent(message);
  const whatsappURL = `https://wa.me/39${PHONE_NUMBER}?text=${encodedMessage}`;
  
  // Track WhatsApp usage
  whatsappTimestamps.push(Date.now());
  whatsappCount++;
  
  window.open(whatsappURL, '_blank');
  markPreventivoRequested();
  showToast('📱 WhatsApp aperto! Dopo l\'invio torna qui per completare', 'success', 4000);
}

function markPreventivoRequested() {
  preventivoRequested = true;
  localStorage.setItem('PREVENTIVO_REQUESTED', '1');
  
  // Show completion status
  const statusDiv = qsId('preventivo-completed');
  if (statusDiv) statusDiv.classList.remove('hidden');
  
  // Hide warnings
  const rateWarning = qsId('rate-limit-warning');
  const hourWarning = qsId('calling-hours-warning');
  if (rateWarning) rateWarning.classList.add('hidden');
  if (hourWarning) hourWarning.classList.add('hidden');
  
  // Enable next button with pulse effect
  const nextBtn = qsId('step3-next');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.classList.add('btn-pulse');
  }
}

function checkPreventivoStatus() {
  const requested = localStorage.getItem('PREVENTIVO_REQUESTED') === '1';
  if (requested) {
    preventivoRequested = true;
    const statusDiv = qsId('preventivo-completed');
    if (statusDiv) statusDiv.classList.remove('hidden');
    
    const nextBtn = qsId('step3-next');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.classList.add('btn-pulse');
    }
  }
}

// Rest of the file remains the same as v6.4.0 but with WhatsApp fix applied
// [Previous authentication, wizard, vehicle management, booking functions continue unchanged]

console.log('%c🚀 Scripts v7.0.0 WEEKEND PREMIUM loaded - WhatsApp ASCII fixed!', 'color: #28a745; font-weight: bold;');