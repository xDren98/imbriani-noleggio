/* ═══════════════════════════════════════════════════════════════════════════════
   IMBRIANI STEFANO NOLEGGIO - scripts.js v6.4.0 MEGA ENHANCEMENT
   + 13 UX Features + Voice Input + Accessibility + Enhanced WhatsApp + Date IT
   ═══════════════════════════════════════════════════════════════════════════════ */

'use strict';

const VERSION = '6.4.0';
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

console.log(`%c🎉 Imbriani Stefano Noleggio v${VERSION} MEGA ENHANCED`, 'font-size: 14px; font-weight: bold; color: #007f17;');

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
// PREVENTIVO UTILITIES (Enhanced)
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
  
  return `🚐 PREVENTIVO PULMINO 📋
━━━━━━━━━━━━━━━━━━━━
📅 Dal: ${formattaDataIT(dataRitiro)} alle ${oraRitiro}
📅 Al: ${formattaDataIT(dataConsegna)} alle ${oraConsegna}
🎯 Destinazione: ${destinazione}
🚐 Pulmino: ${targa} (${posti} posti)
⏰ Durata: ${durationText}
━━━━━━━━━━━━━━━━━━━━
Grazie! 🙏`;
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

  console.log('🔧 App initialized with 13 enhancements');
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

// =====================
// AUTHENTICATION
// =====================
async function handleLogin(e) {
  e.preventDefault();
  const cfInput = qsId('cf-input');
  const cf = (cfInput.value || '').toUpperCase().trim();

  if (!isValidCF(cf)) {
    showToast('Codice Fiscale non valido (16 caratteri A-Z/0-9)', 'danger');
    cfInput.focus();
    return;
  }

  showLoader(true);
  
  try {
    const response = await callAPI('login', { cf });
    
    if (response.success) {
      clienteCorrente = response.data;
      localStorage.setItem(FRONTEND_CONFIG.storage.CF, cf);
      localStorage.setItem(FRONTEND_CONFIG.storage.USER_DATA, JSON.stringify(clienteCorrente));
      
      showUserDashboard();
      await loadInitialData();
      
      showToast(`Benvenuto${clienteCorrente.Nome ? ', ' + clienteCorrente.Nome : ''}!`, 'success');
    } else {
      showToast(response.message || 'Errore di accesso', 'danger');
    }
  } catch (error) {
    showToast('Errore di connessione al server', 'danger');
  } finally {
    showLoader(false);
  }
}

function showUserDashboard() {
  // Hide homepage sections and show user dashboard
  const homepageSections = qsId('homepage-sections');
  const userDashboard = qsId('user-dashboard');
  
  if (homepageSections) homepageSections.classList.add('hidden');
  if (userDashboard) userDashboard.classList.remove('hidden');
  
  const userName = qsId('user-name');
  if (userName && clienteCorrente) {
    userName.textContent = clienteCorrente.Nome || 'Cliente';
  }
}

function handleLogout() {
  clienteCorrente = null;
  prenotazioniUtente = [];
  availableVehicles = [];
  preventivoRequested = false;
  whatsappCount = 0;
  whatsappTimestamps = [];
  clearBookingDraft();
  
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
  
  Object.values(FRONTEND_CONFIG.storage).forEach(key => {
    localStorage.removeItem(key);
  });
  localStorage.removeItem('PREVENTIVO_REQUESTED');
  
  // Show homepage sections and hide user dashboard
  const homepageSections = qsId('homepage-sections');
  const userDashboard = qsId('user-dashboard');
  
  if (homepageSections) homepageSections.classList.remove('hidden');
  if (userDashboard) userDashboard.classList.add('hidden');
  
  qsId('cf-input').value = '';
  
  showToast('Disconnesso', 'info');
}

// =====================
// NEW CUSTOMER CTA (DUAL HOMEPAGE)
// =====================
function handleNewCustomerCTA() {
  // Hide homepage sections and show user dashboard in wizard mode
  const homepageSections = qsId('homepage-sections');
  const userDashboard = qsId('user-dashboard');
  
  if (homepageSections) homepageSections.classList.add('hidden');
  if (userDashboard) userDashboard.classList.remove('hidden');
  
  // Switch to wizard tab
  switchTab('nuovo');
  
  // Pre-fill dates and go directly to Step 2 (vehicle selection)
  preFillWizardDefaults();
  
  setTimeout(() => {
    goToStep(2);
    loadAvailableVehicles();
    showToast('🎆 Ecco i nostri pulmini 9 posti disponibili!', 'info', 4000);
  }, 500);
}

// =====================
// INITIAL DATA LOADING
// =====================
async function loadInitialData() {
  await Promise.all([
    loadUserBookings(),
    loadAvailableVehicles()
  ]);
}

async function loadUserBookings() {
  if (!clienteCorrente?.CF) return;
  
  try {
    const response = await callAPI('recuperaPrenotazioni', { cf: clienteCorrente.CF });
    
    if (response.success) {
      prenotazioniUtente = response.data || [];
      renderUserBookings();
    }
  } catch (error) {
    console.error('Load bookings error:', error);
  }
}

async function loadAvailableVehicles() {
  try {
    const response = await callAPI('disponibilita');
    
    if (response.success) {
      availableVehicles = response.data || [];
      renderVehicles(availableVehicles);
    }
  } catch (error) {
    console.error('Load vehicles error:', error);
  }
}

// =====================
// TAB MANAGEMENT (EXISTING CUSTOMERS)
// =====================
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });

  // Tab-specific actions
  if (tabName === 'prenotazioni') {
    loadUserBookings();
  } else if (tabName === 'nuovo') {
    prepareWizard();
  } else if (tabName === 'profilo') {
    loadUserProfile();
  }
}

// =====================
// WIZARD MANAGEMENT (5 STEPS Enhanced)
// =====================
function prepareWizard() {
  // Load saved draft if available
  const draft = loadBookingDraft();
  if (draft) {
    restoreDraftData(draft);
  } else {
    // Pre-fill with smart defaults
    preFillWizardDefaults();
  }
  
  // Reset to step 1
  goToStep(1);
  
  // Clear and re-add first driver
  const container = qsId('autisti-container');
  if (container) container.innerHTML = '';
  
  // Reset preventivo status
  preventivoRequested = false;
  localStorage.removeItem('PREVENTIVO_REQUESTED');
  
  setTimeout(() => addDriver(true), 100); // First driver with auto-fill
}

function preFillWizardDefaults() {
  // Tomorrow as default pickup date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // Day after tomorrow as default return date
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];
  
  // Smart time selection based on current time
  const now = new Date();
  const currentHour = now.getHours();
  let defaultTime = '08:00';
  
  if (currentHour >= 8 && currentHour < 12) defaultTime = '12:00';
  else if (currentHour >= 12 && currentHour < 16) defaultTime = '16:00';
  else if (currentHour >= 16) defaultTime = '20:00';
  
  // Fill form fields
  const fields = {
    'data-ritiro': tomorrowStr,
    'ora-ritiro': defaultTime,
    'data-consegna': dayAfterStr,
    'ora-consegna': defaultTime
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const field = qsId(id);
    if (field && !field.value) {
      field.value = value;
      console.log(`📅 Pre-filled ${id}: ${value}`);
    }
  });
}

function goToStep(stepNum) {
  // Update progress indicators (5 steps)
  document.querySelectorAll('.progress-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 <= stepNum);
    step.classList.toggle('completed', idx + 1 < stepNum);
  });
  
  // Update step content
  document.querySelectorAll('.wizard-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === stepNum);
  });
  
  stepAttuale = stepNum;
  
  // Update breadcrumbs
  updateBreadcrumbs();
  
  // Step 3 specific: update preventivo summary
  if (stepNum === 3) {
    updatePreventivoSummary();
    checkPreventivoStatus();
    showCallingHoursWarning();
  }
  
  // Auto-focus primo campo del step
  setTimeout(() => {
    const activeStep = document.querySelector('.wizard-step.active');
    const firstInput = activeStep?.querySelector('input:not([readonly]), select, button:not(:disabled)');
    if (firstInput && stepNum !== 3) firstInput.focus(); // Skip focus on preventivo step
  }, 100);
  
  // Auto-scroll to step
  setTimeout(() => {
    const activeStep = document.querySelector('.wizard-step.active');
    if (activeStep) activeStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

function validateAndGoToStep(stepNum) {
  if (stepNum === 2) {
    if (!validateStep1()) return;
    collectStep1Data();
    loadAvailableVehicles(); // Refresh vehicles for selected dates
  }
  
  if (stepNum === 3) {
    if (!bookingData.selectedVehicle) {
      showToast('Seleziona un pulmino per continuare', 'warning');
      return;
    }
  }
  
  if (stepNum === 4) {
    // Check preventivo requirement (MANDATORY FOR ALL)
    if (!preventivoRequested && localStorage.getItem('PREVENTIVO_REQUESTED') !== '1') {
      showToast('📞 Prima richiedi un preventivo chiamando o scrivendo su WhatsApp', 'warning');
      return;
    }
  }
  
  if (stepNum === 5) {
    const drivers = collectDriverData();
    if (!drivers.length) {
      showToast('Aggiungi almeno un autista valido', 'warning');
      return;
    }
    if (drivers.some(d => !isValidCF(d.CF))) {
      showToast('Controlla i codici fiscali degli autisti', 'warning');
      return;
    }
    if (!checkCFDuplicates()) {
      showToast('Risolvi i codici fiscali duplicati', 'warning');
      return;
    }
    bookingData.drivers = drivers;
    updateBookingSummary();
  }
  
  goToStep(stepNum);
}

function validateStep1() {
  const required = ['data-ritiro', 'ora-ritiro', 'data-consegna', 'ora-consegna', 'destinazione'];
  const missing = [];
  
  for (const fieldId of required) {
    const field = qsId(fieldId);
    if (!field || !field.value.trim()) {
      missing.push(fieldId.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()));
      field?.classList.add('error');
    } else {
      field?.classList.remove('error');
    }
  }
  
  if (missing.length) {
    showToast(`Compila: ${missing.join(', ')}`, 'warning');
    return false;
  }
  
  // Date logic validation
  const dataRitiro = new Date(qsId('data-ritiro').value);
  const dataConsegna = new Date(qsId('data-consegna').value);
  const oggi = new Date();
  oggi.setHours(0,0,0,0);
  
  if (dataRitiro < oggi) {
    showToast('La data di ritiro non può essere nel passato', 'warning');
    qsId('data-ritiro').focus();
    return false;
  }
  
  if (dataConsegna < dataRitiro) {
    showToast('La data di consegna deve essere successiva al ritiro', 'warning');
    qsId('data-consegna').focus();
    return false;
  }
  
  return true;
}

function collectStep1Data() {
  bookingData = {
    ...bookingData,
    dataRitiro: qsId('data-ritiro').value,
    oraRitiro: qsId('ora-ritiro').value,
    dataConsegna: qsId('data-consegna').value,
    oraConsegna: qsId('ora-consegna').value,
    destinazione: qsId('destinazione').value.trim()
  };
  
  // Reset preventivo quando cambiano le date/pulmino
  preventivoRequested = false;
  localStorage.removeItem('PREVENTIVO_REQUESTED');
  
  saveBookingDraft(bookingData);
}

// =====================
// VEHICLE MANAGEMENT
// =====================
function renderVehicles(vehicles) {
  const container = qsId('veicoli-list');
  if (!container) return;
  
  if (!vehicles.length) {
    container.innerHTML = '<div class="empty-message">🚗 Nessun pulmino disponibile per il periodo selezionato</div>';
    return;
  }
  
  container.innerHTML = vehicles.map(vehicle => `
    <div class="vehicle-card" data-targa="${vehicle.Targa}" onclick="selectVehicle('${vehicle.Targa}', this)">
      <div class="vehicle-header">
        <strong>🚗 ${vehicle.Targa}</strong>
        <span class="vehicle-badge">👥 ${vehicle.Posti} posti</span>
      </div>
      <div class="vehicle-details">
        <div class="vehicle-model">${vehicle.Marca} ${vehicle.Modello}</div>
        ${vehicle.Note ? `<div class="vehicle-note">📝 ${vehicle.Note}</div>` : ''}
        <div class="vehicle-status">✅ Disponibile</div>
      </div>
    </div>
  `).join('');
}

function selectVehicle(targa, element) {
  // Remove previous selection
  document.querySelectorAll('.vehicle-card.active').forEach(card => {
    card.classList.remove('active');
  });
  
  // Add new selection
  element.classList.add('active');
  
  // Save selected vehicle
  bookingData.selectedVehicle = availableVehicles.find(v => v.Targa === targa);
  bookingData.targa = targa;
  
  // Reset preventivo when vehicle changes
  preventivoRequested = false;
  localStorage.removeItem('PREVENTIVO_REQUESTED');
  
  // Enable next button
  const nextBtn = qsId('step2-next');
  if (nextBtn) nextBtn.disabled = false;
  
  saveBookingDraft(bookingData);
  showToast(`✅ Selezionato: ${targa}`, 'success');
}

// =====================
// DRIVER MANAGEMENT (Full Name)
// =====================
function addDriver(isFirst = false) {
  const container = qsId('autisti-container');
  if (!container) return;
  
  const currentCount = container.children.length;
  if (currentCount >= FRONTEND_CONFIG.validation.MAX_AUTISTI) {
    showToast(`Massimo ${FRONTEND_CONFIG.validation.MAX_AUTISTI} autisti`, 'warning');
    return;
  }
  
  // 🎯 Auto-fill data from last booking if first driver and existing customer
  const prefillData = isFirst && clienteCorrente?.ultimoAutista ? clienteCorrente.ultimoAutista : {};
  
  const driverForm = document.createElement('div');
  driverForm.className = 'driver-form';
  driverForm.innerHTML = createDriverFormHTML(currentCount + 1, isFirst, prefillData);
  
  container.appendChild(driverForm);
  
  // Bind remove button if not first driver
  if (!isFirst) {
    const removeBtn = driverForm.querySelector('.remove-driver');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeDriver(removeBtn));
    }
  }
  
  // Bind real-time validation
  bindDriverValidation(driverForm);
  updateDriverValidation();
}

function createDriverFormHTML(index, isFirst, prefillData) {
  // Use full name from prefillData.Nome (already contains both name and surname)
  const fullName = prefillData.Nome || (isFirst && clienteCorrente ? clienteCorrente.Nome || '' : '');
  
  return `
    <div class="driver-header">
      <h5>👤 Autista ${index}${isFirst ? ' (Intestatario)' : ''}</h5>
      ${!isFirst ? '<button type="button" class="btn btn-sm btn-outline remove-driver">❌ Rimuovi</button>' : ''}
    </div>
    <div class="driver-fields">
      <div class="form-group">
        <label>Nome Completo:</label>
        <input type="text" class="driver-nome-completo" value="${fullName}" placeholder="Es: Mario Rossi" required>
        <div class="input-hint">Nome e cognome separati da spazio (minimo 2 parole)</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Codice Fiscale:</label>
          <input type="text" class="driver-cf" maxlength="16" value="${prefillData.CF || (isFirst && clienteCorrente ? clienteCorrente.CF || '' : '')}" required>
        </div>
        <div class="form-group">
          <label>Data di nascita:</label>
          <input type="date" class="driver-data-nascita" value="${toISODate(prefillData.DataNascita)}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Luogo di nascita:</label>
          <input type="text" class="driver-luogo-nascita" value="${prefillData.LuogoNascita || ''}">
        </div>
        <div class="form-group">
          <label>Comune residenza:</label>
          <input type="text" class="driver-comune" value="${prefillData.ComuneResidenza || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Indirizzo completo:</label>
          <input type="text" class="driver-indirizzo" value="${composeAddress(prefillData.ViaResidenza, prefillData.CivicoResidenza, '')}">
        </div>
        <div class="form-group">
          <label>Numero patente:</label>
          <input type="text" class="driver-patente" value="${prefillData.NumeroPatente || ''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Patente dal:</label>
          <input type="date" class="driver-inizio-patente" value="${toISODate(prefillData.InizioPatente)}">
        </div>
        <div class="form-group">
          <label>Scadenza patente:</label>
          <input type="date" class="driver-scadenza" value="${toISODate(prefillData.ScadenzaPatente)}" required>
        </div>
      </div>
    </div>
  `;
}

function bindDriverValidation(driverForm) {
  const cfInput = driverForm.querySelector('.driver-cf');
  const nameInput = driverForm.querySelector('.driver-nome-completo');
  
  // CF validation
  if (cfInput) {
    cfInput.addEventListener('input', (e) => {
      const cf = e.target.value.toUpperCase();
      e.target.value = cf;
      
      if (cf.length === 16) {
        if (isValidCF(cf)) {
          e.target.classList.remove('error');
          e.target.classList.add('valid');
        } else {
          e.target.classList.add('error');
          e.target.classList.remove('valid');
        }
      } else {
        e.target.classList.remove('error', 'valid');
      }
      
      // Check for duplicates after each input
      setTimeout(checkCFDuplicates, 100);
    });
  }
  
  // Full name validation
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      validateFullName(e.target);
      updateDriverValidation();
    });
    
    nameInput.addEventListener('blur', (e) => {
      if (!validateFullName(e.target)) {
        showToast('Il nome deve contenere almeno nome e cognome', 'warning');
      }
    });
  }
}

function removeDriver(btn) {
  const driverForm = btn.closest('.driver-form');
  if (driverForm) {
    driverForm.remove();
    updateDriverNumbers();
    updateDriverValidation();
    checkCFDuplicates();
  }
}

function updateDriverNumbers() {
  document.querySelectorAll('.driver-form').forEach((form, index) => {
    const header = form.querySelector('.driver-header h5');
    if (header) {
      const isFirst = index === 0;
      header.innerHTML = `👤 Autista ${index + 1}${isFirst ? ' (Intestatario)' : ''}`;
    }
  });
}

function updateDriverValidation() {
  const driversCount = document.querySelectorAll('.driver-form').length;
  const validDrivers = collectDriverData();
  
  const nextBtn = qsId('step4-next');
  if (nextBtn) {
    nextBtn.disabled = validDrivers.length < FRONTEND_CONFIG.validation.MIN_AUTISTI || !checkCFDuplicates();
  }
}

function collectDriverData() {
  const drivers = [];
  document.querySelectorAll('.driver-form').forEach(form => {
    const nomeCompleto = form.querySelector('.driver-nome-completo').value.trim();
    
    const driver = {
      Nome: nomeCompleto, // Store full name as single field
      CF: form.querySelector('.driver-cf').value.toUpperCase().trim(),
      DataNascita: form.querySelector('.driver-data-nascita').value,
      LuogoNascita: form.querySelector('.driver-luogo-nascita')?.value.trim() || '',
      ComuneResidenza: form.querySelector('.driver-comune')?.value.trim() || '',
      ViaResidenza: form.querySelector('.driver-indirizzo')?.value.trim() || '',
      CivicoResidenza: '', // Parsed from address if needed
      NumeroPatente: form.querySelector('.driver-patente').value.trim(),
      InizioPatente: form.querySelector('.driver-inizio-patente')?.value || '',
      ScadenzaPatente: form.querySelector('.driver-scadenza').value,
      Cellulare: clienteCorrente?.Cellulare || '',
      Email: clienteCorrente?.Email || ''
    };
    
    // Convert dates to Italian format for Google Sheets
    if (driver.DataNascita) driver.DataNascita = toItalianDate(driver.DataNascita);
    if (driver.InizioPatente) driver.InizioPatente = toItalianDate(driver.InizioPatente);
    if (driver.ScadenzaPatente) driver.ScadenzaPatente = toItalianDate(driver.ScadenzaPatente);
    
    // Validate required fields + full name
    const nameWords = nomeCompleto.split(/\s+/).filter(w => w.length > 0);
    if (nameWords.length >= 2 && isValidCF(driver.CF) && driver.NumeroPatente && driver.ScadenzaPatente) {
      drivers.push(driver);
    }
  });
  return drivers;
}

// =====================
// BOOKING MANAGEMENT
// =====================
function renderUserBookings() {
  const container = qsId('prenotazioni-list');
  const emptyState = qsId('empty-bookings');
  
  if (!container) return;
  
  if (!prenotazioniUtente.length) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  
  if (emptyState) emptyState.classList.add('hidden');
  
  container.innerHTML = prenotazioniUtente.map(booking => {
    const statusEmoji = FRONTEND_CONFIG.statiEmoji[booking.Stato] || '❓';
    const statusClass = (booking.Stato || '').toLowerCase().replace(/\s+/g, '-');
    
    return `
      <div class="booking-item">
        <div class="booking-header">
          <span class="booking-id">#${booking.ID || 'N/A'}</span>
          <span class="booking-status ${statusClass}">${statusEmoji} ${booking.Stato || 'Da Confermare'}</span>
        </div>
        <div class="booking-info">
          <div class="booking-dates">
            📅 ${formattaDataIT(booking.DataRitiro)} ${booking.OraRitiro || ''} → ${formattaDataIT(booking.DataConsegna)} ${booking.OraConsegna || ''}
          </div>
          <div class="booking-destination">🎯 ${booking.Destinazione || 'Non specificata'}</div>
          <div class="booking-vehicle">🚗 ${booking.Targa || 'Veicolo da assegnare'}</div>
          <div class="booking-created">📅 Creata: ${formattaDataIT(booking.DataCreazione)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateBookingSummary() {
  const summaryContainer = qsId('booking-summary');
  if (!summaryContainer || !bookingData.drivers) return;
  
  const { dataRitiro, oraRitiro, dataConsegna, oraConsegna, destinazione, targa, drivers } = bookingData;
  
  summaryContainer.innerHTML = `
    <div class="summary-section">
      <h4>📋 Riepilogo Prenotazione</h4>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Periodo:</span>
          <span class="summary-value">${formattaDataIT(dataRitiro)} ${oraRitiro} → ${formattaDataIT(dataConsegna)} ${oraConsegna}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Destinazione:</span>
          <span class="summary-value">${destinazione}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Pulmino:</span>
          <span class="summary-value">🚗 ${targa}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Autisti:</span>
          <span class="summary-value">${drivers.length} persona/e</span>
        </div>
      </div>
    </div>
    <div class="summary-drivers">
      <h5>👥 Dettagli Autisti:</h5>
      ${drivers.map((d, i) => `
        <div class="driver-summary">
          <strong>Autista ${i + 1}:</strong> ${d.Nome} (${d.CF})
          <br><small>📝 Patente: ${d.NumeroPatente} - Scad: ${d.ScadenzaPatente}</small>
        </div>
      `).join('')}
    </div>
    <div class="booking-note">
      <p><strong>🎯 Nota:</strong> Dopo l'invio riceverai un ID prenotazione univoco formato <code>BOOK-2025-XXX</code></p>
      <p><small>La prenotazione sarà in stato "Da Confermare" fino all'approvazione dell'admin.</small></p>
      <p><strong>💰 Preventivo già richiesto</strong> - La prenotazione includerà il preventivo concordato.</p>
    </div>
  `;
}

async function submitBooking() {
  if (!bookingData.drivers?.length) {
    showToast('Errore: nessun autista valido', 'danger');
    return;
  }
  
  if (!preventivoRequested && localStorage.getItem('PREVENTIVO_REQUESTED') !== '1') {
    showToast('💰 Prima richiedi un preventivo!', 'danger');
    return;
  }
  
  if (!checkCFDuplicates()) {
    showToast('❌ Risolvi i codici fiscali duplicati', 'danger');
    return;
  }
  
  showLoader(true);
  
  const payload = {
    cf: clienteCorrente?.CF || bookingData.drivers[0]?.CF, // Use first driver CF if no customer logged in
    ...bookingData,
    // Convert booking dates to Italian format
    dataRitiro: toItalianDate(bookingData.dataRitiro),
    dataConsegna: toItalianDate(bookingData.dataConsegna),
    drivers: encodeURIComponent(JSON.stringify(bookingData.drivers)),
    preventivoRichiesto: true // Flag per backend
  };
  delete payload.selectedVehicle; // Non serve nel backend
  
  try {
    const response = await callAPI('creaPrenotazione', payload);
    
    if (response.success) {
      const bookingID = response.data?.id || 'N/A';
      showToast(`✅ Prenotazione ${bookingID} inviata con preventivo!`, 'success', 5000);
      clearBookingDraft();
      localStorage.removeItem('PREVENTIVO_REQUESTED');
      resetWizard();
      
      // If not logged in (new customer), show homepage
      if (!clienteCorrente) {
        const homepageSections = qsId('homepage-sections');
        const userDashboard = qsId('user-dashboard');
        
        if (homepageSections) homepageSections.classList.remove('hidden');
        if (userDashboard) userDashboard.classList.add('hidden');
        
        showToast('🎉 Grazie per aver scelto Imbriani Stefano Noleggio!', 'info', 3000);
      } else {
        // If logged in, show bookings tab
        switchTab('prenotazioni');
        await loadUserBookings();
      }
      
    } else {
      showToast(response.message || 'Errore durante la prenotazione', 'danger');
    }
  } catch (error) {
    showToast('Errore di connessione', 'danger');
  } finally {
    showLoader(false);
  }
}

// =====================
// PROFILE MANAGEMENT (Full Name)
// =====================
function loadUserProfile() {
  if (!clienteCorrente) return;

  // Use full name directly (no splitting needed)
  const fullName = (clienteCorrente.Nome || '').trim();

  // 🎯 Composizione indirizzo completo da ultimoAutista
  const ultimoAutista = clienteCorrente.ultimoAutista || {};
  const indirizzoCompleto = composeAddress(
    ultimoAutista.ViaResidenza,
    ultimoAutista.CivicoResidenza,
    ultimoAutista.ComuneResidenza
  );

  const fields = {
    'profile-nome-completo': fullName,
    'profile-email': clienteCorrente.Email || '',
    'profile-telefono': clienteCorrente.Cellulare || '',
    'profile-luogo-nascita': ultimoAutista.LuogoNascita || '',
    'profile-indirizzo': indirizzoCompleto,
    'profile-patente': ultimoAutista.NumeroPatente || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = qsId(id);
    if (element) {
      element.value = value;
      console.log(`👤 Profile loaded ${id}: ${value}`);
    }
  });

  // 📅 Date fields with ISO conversion
  const dataNascita = qsId('profile-data-nascita');
  if (dataNascita) {
    dataNascita.value = toISODate(ultimoAutista.DataNascita);
    console.log(`📅 Data nascita: ${ultimoAutista.DataNascita} → ${dataNascita.value}`);
  }

  const scadenzaPatente = qsId('profile-patente-scadenza');
  if (scadenzaPatente) {
    scadenzaPatente.value = toISODate(ultimoAutista.ScadenzaPatente);
    console.log(`📅 Scadenza patente: ${ultimoAutista.ScadenzaPatente} → ${scadenzaPatente.value}`);
  }
}

// =====================
// DRAFT MANAGEMENT (Enhanced)
// =====================
function saveDraftData() {
  if (stepAttuale === 1) {
    collectStep1Data();
  }
  console.log('💾 Draft saved automatically');
}

function restoreDraftData(draft) {
  if (!draft) return;
  
  const fieldMappings = {
    'data-ritiro': 'dataRitiro',
    'ora-ritiro': 'oraRitiro', 
    'data-consegna': 'dataConsegna',
    'ora-consegna': 'oraConsegna',
    'destinazione': 'destinazione'
  };
  
  Object.entries(fieldMappings).forEach(([fieldId, draftKey]) => {
    const field = qsId(fieldId);
    if (field && draft[draftKey]) {
      field.value = draft[draftKey];
    }
  });
  
  bookingData = { ...draft };
}

function resetWizard() {
  stepAttuale = 1;
  bookingData = {};
  preventivoRequested = false;
  localStorage.removeItem('PREVENTIVO_REQUESTED');
  goToStep(1);
  
  // Clear drivers container
  const container = qsId('autisti-container');
  if (container) container.innerHTML = '';
  
  // Pre-fill defaults and add first driver
  preFillWizardDefaults();
  setTimeout(() => addDriver(true), 100);
  
  clearBookingDraft();
}

console.log('%c🔧 Scripts v6.4.0 MEGA ENHANCED loaded successfully - 13 features active!', 'color: #28a745; font-weight: bold;');