/* ================================================================================
   IMBRIANI STEFANO NOLEGGIO - scripts.js v7.0.1 COMPLETE + ASCII FIX
   + All functions restored + WhatsApp ASCII only message
   ================================================================================ */

'use strict';

const VERSION = '7.0.1';
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

console.log(`%c[VAN] Imbriani Stefano Noleggio v${VERSION} COMPLETE RESTORED`, 'font-size: 14px; font-weight: bold; color: #007f17;');

// =====================
// DATE UTILITIES
// =====================
function toISODate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0,10);

  const s = String(value).trim();
  if (!s) return '';

  // Already ISO yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/MM/yyyy or dd-MM-yyyy
  let m = s.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // yyyy-MM-ddTHH:mm:ss(.sss)Z
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  } catch(e) {}

  return '';
}

function toItalianDate(isoDate) {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return isoDate;
}

function formattaDataIT(dateObj) {
  if (!dateObj) return '';
  if (typeof dateObj === 'string') {
    const match = dateObj.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return dateObj;
  }
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function composeAddress(via, civico, comune) {
  const parts = [via, civico, comune].filter(p => p && String(p).trim());
  return parts.join(' ');
}

// =====================
// WHATSAPP ASCII-ONLY MESSAGE (FIXED)
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
  
  // 100% ASCII MESSAGE - No Unicode, No Emoji, No Special Characters
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
    <div class="summary-row"><span>[VAN] Pulmino:</span> <strong>${bookingData.targa} (${posti} posti)</strong></div>
    <div class="summary-row"><span>[CAL] Ritiro:</span> <strong>${formattaDataIT(bookingData.dataRitiro)} alle ${bookingData.oraRitiro}</strong></div>
    <div class="summary-row"><span>[CAL] Consegna:</span> <strong>${formattaDataIT(bookingData.dataConsegna)} alle ${bookingData.oraConsegna}</strong></div>
    <div class="summary-row"><span>[TARGET] Destinazione:</span> <strong>${bookingData.destinazione}</strong></div>
    <div class="summary-row"><span>[TIME] Durata:</span> <strong>${durationText}</strong></div>
  `;
}

// =====================
// RATE LIMITING
// =====================
function checkRateLimit() {
  const now = Date.now();
  whatsappTimestamps = whatsappTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  return whatsappTimestamps.length < MAX_WHATSAPP_PER_WINDOW;
}

function getRateLimitTimeRemaining() {
  if (whatsappTimestamps.length === 0) return 0;
  const oldestTimestamp = Math.min(...whatsappTimestamps);
  const timeRemaining = RATE_LIMIT_WINDOW - (Date.now() - oldestTimestamp);
  return Math.max(0, Math.ceil(timeRemaining / 1000 / 60));
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
    console.log('[MIC] Voice recognition not supported');
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
      showToast(`[MIC] Registrato: ${transcript}`, 'success');
    }
  };
  
  voiceRecognition.onerror = (event) => {
    showToast('[MIC] Errore registrazione vocale', 'warning');
  };
  
  const voiceBtn = qsId('voice-input-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      if (voiceRecognition) {
        voiceBtn.classList.add('recording');
        showToast('[MIC] Parla ora...', 'info', 3000);
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
  
  const contrastEnabled = localStorage.getItem('contrast-mode') === '1';
  if (contrastEnabled) {
    document.body.classList.add('high-contrast');
    contrastToggle.textContent = '[**]';
  }
  
  contrastToggle.addEventListener('click', () => {
    const isEnabled = document.body.classList.toggle('high-contrast');
    localStorage.setItem('contrast-mode', isEnabled ? '1' : '0');
    contrastToggle.textContent = isEnabled ? '[**]' : '[*]';
    showToast(isEnabled ? '[**] Contrasto elevato attivato' : '[*] Contrasto normale', 'info');
  });
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
  if (elem) elem.classList.toggle('hidden', !show);
}

// =====================
// AUTHENTICATION
// =====================
function isValidCF(cf) {
  const cfUpper = String(cf).toUpperCase().trim();
  if (cfUpper.length !== 16) return false;
  return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(cfUpper);
}

async function handleLogin(e) {
  e.preventDefault();
  
  const cfInput = qsId('cf-input');
  const cf = cfInput.value.toUpperCase().trim();
  
  if (!isValidCF(cf)) {
    showToast('[!] CF non valido (16 caratteri A-Z/0-9)', 'error');
    return;
  }
  
  showLoader(true);
  
  try {
    const response = await callAPI('getUserData', { cf });
    
    if (response.success) {
      clienteCorrente = response.data;
      localStorage.setItem(FRONTEND_CONFIG.storage.CF, cf);
      
      showToast(`[OK] Benvenuto ${clienteCorrente.NomeCompleto || 'Cliente'}!`, 'success');
      
      // Hide homepage sections
      const homepageSections = qsId('homepage-sections');
      if (homepageSections) homepageSections.classList.add('hidden');
      
      // Show dashboard
      const dashboard = qsId('user-dashboard');
      if (dashboard) dashboard.classList.remove('hidden');
      
      // Update user info
      const userName = qsId('user-name');
      if (userName) userName.textContent = clienteCorrente.NomeCompleto || 'Cliente';
      
      // Load user bookings
      await loadUserBookings();
      
    } else {
      showToast(`[X] ${response.message || 'Errore login'}`, 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('[X] Errore di connessione', 'error');
  } finally {
    showLoader(false);
  }
}

function handleLogout() {
  clienteCorrente = null;
  localStorage.removeItem(FRONTEND_CONFIG.storage.CF);
  
  // Show homepage sections
  const homepageSections = qsId('homepage-sections');
  if (homepageSections) homepageSections.classList.remove('hidden');
  
  // Hide dashboard
  const dashboard = qsId('user-dashboard');
  if (dashboard) dashboard.classList.add('hidden');
  
  // Clear CF input
  const cfInput = qsId('cf-input');
  if (cfInput) cfInput.value = '';
  
  showToast('[EXIT] Disconnesso', 'info');
}

// =====================
// NEW CUSTOMER CTA
// =====================
function handleNewCustomerCTA() {
  // Auto-fill tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);
  
  // Set default pickup date
  const dataRitiro = qsId('data-ritiro');
  if (dataRitiro) dataRitiro.value = tomorrowISO;
  
  // Set default return date (day after tomorrow)
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  const dayAfterTomorrowISO = dayAfterTomorrow.toISOString().slice(0, 10);
  
  const dataConsegna = qsId('data-consegna');
  if (dataConsegna) dataConsegna.value = dayAfterTomorrowISO;
  
  // Set default times
  const oraRitiro = qsId('ora-ritiro');
  const oraConsegna = qsId('ora-consegna');
  if (oraRitiro) oraRitiro.value = '08:00';
  if (oraConsegna) oraConsegna.value = '20:00';
  
  // Hide homepage and show dashboard with new booking tab
  const homepageSections = qsId('homepage-sections');
  if (homepageSections) homepageSections.classList.add('hidden');
  
  const dashboard = qsId('user-dashboard');
  if (dashboard) dashboard.classList.remove('hidden');
  
  // Switch to new booking tab
  switchTab('nuovo');
  
  // Go to step 1
  goToStep(1);
  
  showToast('[GO] Date preimpostate per domani!', 'info');
}

// =====================
// TAB MANAGEMENT
// =====================
function switchTab(tabName) {
  // Update tab buttons
  qsAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  
  // Update tab contents
  qsAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
  
  // Load data if needed
  if (tabName === 'prenotazioni') {
    loadUserBookings();
  } else if (tabName === 'nuovo') {
    loadAvailableVehicles();
  }
}

// =====================
// WIZARD MANAGEMENT
// =====================
function goToStep(step) {
  stepAttuale = step;
  
  // Update wizard steps visibility
  for (let i = 1; i <= 5; i++) {
    const stepEl = qsId(`step-${i}`);
    if (stepEl) showElement(stepEl, i === step);
  }
  
  // Update progress indicators
  updateProgressIndicators();
  updateBreadcrumbs();
  
  // Step-specific logic
  if (step === 2) {
    loadAvailableVehicles();
  } else if (step === 3) {
    updatePreventivoSummary();
    checkPreventivoStatus();
  } else if (step === 4) {
    if (!bookingData.drivers || bookingData.drivers.length === 0) {
      addDriver(); // Add first driver
    }
    renderDrivers();
  } else if (step === 5) {
    generateBookingSummary();
  }
}

function validateAndGoToStep(targetStep) {
  if (validateCurrentStep()) {
    goToStep(targetStep);
  }
}

function validateCurrentStep() {
  switch (stepAttuale) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return validateStep4();
    default:
      return true;
  }
}

function validateStep1() {
  const dataRitiro = qsId('data-ritiro')?.value;
  const oraRitiro = qsId('ora-ritiro')?.value;
  const dataConsegna = qsId('data-consegna')?.value;
  const oraConsegna = qsId('ora-consegna')?.value;
  const destinazione = qsId('destinazione')?.value?.trim();
  
  if (!dataRitiro || !oraRitiro || !dataConsegna || !oraConsegna || !destinazione) {
    showToast('[!] Compila tutti i campi', 'warning');
    return false;
  }
  
  const startDate = new Date(`${dataRitiro}T${oraRitiro}:00`);
  const endDate = new Date(`${dataConsegna}T${oraConsegna}:00`);
  
  if (startDate >= endDate) {
    showToast('[!] Data/ora consegna deve essere dopo il ritiro', 'warning');
    return false;
  }
  
  // Save to booking data
  bookingData = {
    ...bookingData,
    dataRitiro,
    oraRitiro,
    dataConsegna,
    oraConsegna,
    destinazione
  };
  
  saveDraftData();
  return true;
}

function validateStep2() {
  if (!bookingData.selectedVehicle || !bookingData.targa) {
    showToast('[!] Seleziona un pulmino', 'warning');
    return false;
  }
  return true;
}

function validateStep3() {
  if (!preventivoRequested) {
    showToast('[!] Richiedi il preventivo prima di continuare', 'warning');
    return false;
  }
  return true;
}

function validateStep4() {
  if (!bookingData.drivers || bookingData.drivers.length === 0) {
    showToast('[!] Aggiungi almeno un autista', 'warning');
    return false;
  }
  
  // Check CF duplicates
  if (!checkCFDuplicates()) {
    return false;
  }
  
  // Validate all drivers
  for (const driver of bookingData.drivers) {
    if (!driver.nome || !driver.cognome || !driver.cf || !driver.dataNascita || !driver.numeroPatente) {
      showToast('[!] Completa i dati di tutti gli autisti', 'warning');
      return false;
    }
    
    if (!isValidCF(driver.cf)) {
      showToast(`[!] CF non valido per ${driver.nome} ${driver.cognome}`, 'warning');
      return false;
    }
  }
  
  return true;
}

// =====================
// PROGRESS INDICATORS
// =====================
function updateProgressIndicators() {
  qsAll('.progress-step').forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.toggle('active', stepNum === stepAttuale);
    step.classList.toggle('completed', stepNum < stepAttuale);
  });
}

function updateBreadcrumbs() {
  qsAll('.breadcrumb-item').forEach((item, index) => {
    const stepNum = index + 1;
    item.classList.toggle('active', stepNum === stepAttuale);
    item.classList.toggle('completed', stepNum < stepAttuale);
  });
}

// =====================
// VEHICLE MANAGEMENT
// =====================
async function loadAvailableVehicles() {
  const vehiclesList = qsId('veicoli-list');
  if (!vehiclesList) return;
  
  try {
    const response = await callAPI('getAvailableVehicles', {
      dataInizio: bookingData.dataRitiro || '',
      dataFine: bookingData.dataConsegna || ''
    });
    
    if (response.success && response.data) {
      availableVehicles = response.data;
      renderVehicles();
    } else {
      vehiclesList.innerHTML = '<p>[!] Errore caricamento veicoli</p>';
    }
  } catch (error) {
    console.error('Error loading vehicles:', error);
    vehiclesList.innerHTML = '<p>[!] Errore di connessione</p>';
  }
}

function renderVehicles() {
  const vehiclesList = qsId('veicoli-list');
  if (!vehiclesList) return;
  
  if (!availableVehicles || availableVehicles.length === 0) {
    vehiclesList.innerHTML = '<p>[EMPTY] Nessun pulmino disponibile per le date selezionate</p>';
    return;
  }
  
  vehiclesList.innerHTML = '';
  
  availableVehicles.forEach(vehicle => {
    const vehicleCard = document.createElement('div');
    vehicleCard.className = 'vehicle-card';
    if (bookingData.targa === vehicle.Targa) {
      vehicleCard.classList.add('selected');
    }
    
    vehicleCard.innerHTML = `
      <div class="vehicle-info">
        <div class="vehicle-header">
          <h5>${vehicle.Targa}</h5>
          <span class="badge badge-success">[+] 9 posti</span>
        </div>
        <div class="vehicle-details">
          <p><strong>${vehicle.Marca || 'Marca'}</strong> ${vehicle.Modello || 'Modello'}</p>
          <p>[CAR] ${vehicle.Colore || 'Colore non specificato'}</p>
          <p class="availability">[OK] Disponibile</p>
        </div>
      </div>
    `;
    
    vehicleCard.addEventListener('click', () => selectVehicle(vehicle));
    vehiclesList.appendChild(vehicleCard);
  });
}

function selectVehicle(vehicle) {
  // Update booking data
  bookingData.selectedVehicle = vehicle;
  bookingData.targa = vehicle.Targa;
  
  // Update UI
  qsAll('.vehicle-card').forEach(card => card.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  
  // Enable next button
  const nextBtn = qsId('step2-next');
  if (nextBtn) nextBtn.disabled = false;
  
  showToast(`[VAN] Selezionato: ${vehicle.Targa}`, 'success');
  saveDraftData();
}

// =====================
// PREVENTIVO HANDLERS
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
  showToast('[PHONE] Apertura dialer... Dopo la chiamata torna qui!', 'info', 4000);
}

function handleWhatsAppPreventivo() {
  if (!checkRateLimit()) {
    showRateLimitWarning();
    return;
  }
  
  const message = buildPreventivoMessage();
  const encodedMessage = encodeURIComponent(message);
  const whatsappURL = `https://wa.me/39${PHONE_NUMBER}?text=${encodedMessage}`;
  
  whatsappTimestamps.push(Date.now());
  whatsappCount++;
  
  window.open(whatsappURL, '_blank');
  markPreventivoRequested();
  showToast('[MSG] WhatsApp aperto! Dopo invio torna qui per completare', 'success', 4000);
}

function markPreventivoRequested() {
  preventivoRequested = true;
  localStorage.setItem('PREVENTIVO_REQUESTED', '1');
  
  const statusDiv = qsId('preventivo-completed');
  if (statusDiv) statusDiv.classList.remove('hidden');
  
  const rateWarning = qsId('rate-limit-warning');
  const hourWarning = qsId('calling-hours-warning');
  if (rateWarning) rateWarning.classList.add('hidden');
  if (hourWarning) hourWarning.classList.add('hidden');
  
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
// DRIVER MANAGEMENT
// =====================
function addDriver() {
  if (!bookingData.drivers) bookingData.drivers = [];
  
  if (bookingData.drivers.length >= 3) {
    showToast('[!] Massimo 3 autisti', 'warning');
    return;
  }
  
  const newDriver = {
    id: Date.now(),
    nome: '',
    cognome: '',
    cf: '',
    dataNascita: '',
    numeroPatente: ''
  };
  
  bookingData.drivers.push(newDriver);
  renderDrivers();
  updateStep4NextButton();
}

function renderDrivers() {
  const container = qsId('autisti-container');
  if (!container) return;
  
  if (!bookingData.drivers || bookingData.drivers.length === 0) {
    container.innerHTML = '<p>[EMPTY] Nessun autista aggiunto</p>';
    return;
  }
  
  container.innerHTML = '';
  
  bookingData.drivers.forEach((driver, index) => {
    const driverDiv = document.createElement('div');
    driverDiv.className = 'driver-row';
    driverDiv.innerHTML = `
      <div class="driver-header">
        <h6>[USER] Autista ${index + 1}</h6>
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeDriver(${index})">[X] Rimuovi</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nome:</label>
          <input type="text" class="form-control driver-nome" value="${driver.nome}" data-index="${index}">
        </div>
        <div class="form-group">
          <label>Cognome:</label>
          <input type="text" class="form-control driver-cognome" value="${driver.cognome}" data-index="${index}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Codice Fiscale:</label>
          <input type="text" class="form-control driver-cf" value="${driver.cf}" data-index="${index}" maxlength="16">
        </div>
        <div class="form-group">
          <label>Data di Nascita:</label>
          <input type="date" class="form-control driver-data-nascita" value="${driver.dataNascita}" data-index="${index}">
        </div>
      </div>
      <div class="form-group">
        <label>Numero Patente:</label>
        <input type="text" class="form-control driver-patente" value="${driver.numeroPatente}" data-index="${index}">
      </div>
    `;
    
    container.appendChild(driverDiv);
  });
  
  // Add event listeners
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', updateDriverData);
  });
}

function updateDriverData(event) {
  const input = event.target;
  const index = parseInt(input.dataset.index);
  const field = input.className.split(' ').find(cls => cls.startsWith('driver-')).replace('driver-', '');
  
  if (bookingData.drivers && bookingData.drivers[index]) {
    bookingData.drivers[index][field === 'cf' ? 'cf' : field === 'data-nascita' ? 'dataNascita' : field === 'patente' ? 'numeroPatente' : field] = input.value;
    saveDraftData();
    updateStep4NextButton();
  }
}

function removeDriver(index) {
  if (bookingData.drivers && bookingData.drivers[index]) {
    bookingData.drivers.splice(index, 1);
    renderDrivers();
    updateStep4NextButton();
    saveDraftData();
    showToast('[X] Autista rimosso', 'info');
  }
}

function updateStep4NextButton() {
  const nextBtn = qsId('step4-next');
  if (nextBtn) {
    const hasDrivers = bookingData.drivers && bookingData.drivers.length > 0;
    nextBtn.disabled = !hasDrivers;
  }
}

function checkCFDuplicates() {
  const cfInputs = document.querySelectorAll('.driver-cf');
  const cfValues = Array.from(cfInputs).map(input => input.value.toUpperCase().trim()).filter(cf => cf.length === 16);
  
  const duplicates = cfValues.filter((cf, index) => cfValues.indexOf(cf) !== index);
  
  const warning = qsId('cf-duplicate-warning');
  if (warning) {
    if (duplicates.length > 0) {
      warning.classList.remove('hidden');
      cfInputs.forEach(input => {
        const value = input.value.toUpperCase().trim();
        if (duplicates.includes(value)) {
          input.classList.add('error');
        }
      });
      return false;
    } else {
      warning.classList.add('hidden');
      cfInputs.forEach(input => input.classList.remove('error'));
      return true;
    }
  }
  
  return duplicates.length === 0;
}

// =====================
// BOOKING MANAGEMENT
// =====================
async function loadUserBookings() {
  const bookingsList = qsId('prenotazioni-list');
  const emptyState = qsId('empty-bookings');
  
  if (!bookingsList) return;
  
  try {
    let response;
    
    if (clienteCorrente) {
      response = await callAPI('getUserBookings', { cf: clienteCorrente.CF });
    } else {
      // For anonymous users, check if there are any saved bookings
      response = { success: true, data: [] };
    }
    
    if (response.success) {
      prenotazioniUtente = response.data || [];
      
      if (prenotazioniUtente.length === 0) {
        bookingsList.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        bookingsList.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        renderBookings();
      }
    } else {
      showToast('[X] Errore caricamento prenotazioni', 'error');
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
    showToast('[X] Errore di connessione', 'error');
  }
}

function renderBookings() {
  const bookingsList = qsId('prenotazioni-list');
  if (!bookingsList || !prenotazioniUtente) return;
  
  bookingsList.innerHTML = '';
  
  prenotazioniUtente.forEach(booking => {
    const bookingCard = document.createElement('div');
    bookingCard.className = 'booking-card';
    
    const statusClass = getStatusClass(booking.Stato);
    const statusLabel = getStatusLabel(booking.Stato);
    
    bookingCard.innerHTML = `
      <div class="booking-header">
        <h5>${booking.ID}</h5>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="booking-details">
        <p><strong>[CAL] Periodo:</strong> ${formattaDataIT(booking.DataRitiro)} ${booking.OraRitiro} - ${formattaDataIT(booking.DataConsegna)} ${booking.OraConsegna}</p>
        <p><strong>[TARGET] Destinazione:</strong> ${booking.Destinazione}</p>
        <p><strong>[VAN] Pulmino:</strong> ${booking.Targa || 'TBD'}</p>
        <p><strong>[TIME] Creata il:</strong> ${formattaDataIT(booking.DataCreazione)}</p>
      </div>
    `;
    
    bookingsList.appendChild(bookingCard);
  });
}

function getStatusClass(status) {
  const statusMap = {
    'Confermata': 'badge-success',
    'Da confermare': 'badge-warning',
    'Annullata': 'badge-danger'
  };
  return statusMap[status] || 'badge-secondary';
}

function getStatusLabel(status) {
  const labelMap = {
    'Confermata': '[OK] Confermata',
    'Da confermare': '[...] Da confermare',
    'Annullata': '[X] Annullata'
  };
  return labelMap[status] || status;
}

function generateBookingSummary() {
  const summaryContainer = qsId('booking-summary');
  if (!summaryContainer) return;
  
  const startDate = new Date(`${bookingData.dataRitiro}T${bookingData.oraRitiro}:00`);
  const endDate = new Date(`${bookingData.dataConsegna}T${bookingData.oraConsegna}:00`);
  const diffMs = endDate - startDate;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  
  let durationText = '';
  if (days > 0 && hours > 0) durationText = `${days} giorni e ${hours} ore`;
  else if (days > 0) durationText = `${days} giorni`;
  else durationText = `${hours} ore`;
  
  summaryContainer.innerHTML = `
    <div class="summary-section">
      <h4>[LIST] Riepilogo Prenotazione</h4>
      <div class="summary-grid">
        <div class="summary-item">
          <label>[CAL] Ritiro:</label>
          <span>${formattaDataIT(bookingData.dataRitiro)} alle ${bookingData.oraRitiro}</span>
        </div>
        <div class="summary-item">
          <label>[CAL] Consegna:</label>
          <span>${formattaDataIT(bookingData.dataConsegna)} alle ${bookingData.oraConsegna}</span>
        </div>
        <div class="summary-item">
          <label>[TIME] Durata:</label>
          <span>${durationText}</span>
        </div>
        <div class="summary-item">
          <label>[TARGET] Destinazione:</label>
          <span>${bookingData.destinazione}</span>
        </div>
        <div class="summary-item">
          <label>[VAN] Pulmino:</label>
          <span>${bookingData.targa} (${bookingData.selectedVehicle?.Posti || '9'} posti)</span>
        </div>
        <div class="summary-item">
          <label>[USERS] Autisti:</label>
          <span>${bookingData.drivers?.length || 0}</span>
        </div>
      </div>
    </div>
    
    <div class="summary-section">
      <h5>[USERS] Dettagli Autisti</h5>
      <div class="drivers-summary">
        ${bookingData.drivers?.map((driver, index) => `
          <div class="driver-summary">
            <strong>[USER] Autista ${index + 1}:</strong> ${driver.nome} ${driver.cognome}<br>
            <small>CF: ${driver.cf} | Patente: ${driver.numeroPatente}</small>
          </div>
        `).join('') || '<p>[EMPTY] Nessun autista</p>'}
      </div>
    </div>
  `;
}

async function submitBooking() {
  if (!validateStep4()) return;
  
  showLoader(true);
  
  try {
    const bookingPayload = {
      cf: clienteCorrente?.CF || 'ANONYMOUS',
      dataRitiro: bookingData.dataRitiro,
      oraRitiro: bookingData.oraRitiro,
      dataConsegna: bookingData.dataConsegna,
      oraConsegna: bookingData.oraConsegna,
      destinazione: bookingData.destinazione,
      targa: bookingData.targa,
      drivers: bookingData.drivers
    };
    
    const response = await callAPI('createBooking', bookingPayload);
    
    if (response.success) {
      showToast('[OK] Prenotazione inviata con successo!', 'success');
      
      // Clear draft data
      localStorage.removeItem('BOOKING_DRAFT');
      localStorage.removeItem('PREVENTIVO_REQUESTED');
      
      // Reset booking data
      bookingData = {};
      preventivoRequested = false;
      
      // Go back to bookings tab
      switchTab('prenotazioni');
      loadUserBookings();
      
    } else {
      showToast(`[X] ${response.message || 'Errore invio prenotazione'}`, 'error');
    }
  } catch (error) {
    console.error('Error submitting booking:', error);
    showToast('[X] Errore di connessione', 'error');
  } finally {
    showLoader(false);
  }
}

// =====================
// DRAFT MANAGEMENT
// =====================
function saveDraftData() {
  try {
    localStorage.setItem('BOOKING_DRAFT', JSON.stringify(bookingData));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
}

function loadDraftData() {
  try {
    const draft = localStorage.getItem('BOOKING_DRAFT');
    if (draft) {
      bookingData = JSON.parse(draft);
      
      // Restore form values
      if (bookingData.dataRitiro) {
        const dataRitiro = qsId('data-ritiro');
        if (dataRitiro) dataRitiro.value = bookingData.dataRitiro;
      }
      
      if (bookingData.oraRitiro) {
        const oraRitiro = qsId('ora-ritiro');
        if (oraRitiro) oraRitiro.value = bookingData.oraRitiro;
      }
      
      if (bookingData.dataConsegna) {
        const dataConsegna = qsId('data-consegna');
        if (dataConsegna) dataConsegna.value = bookingData.dataConsegna;
      }
      
      if (bookingData.oraConsegna) {
        const oraConsegna = qsId('ora-consegna');
        if (oraConsegna) oraConsegna.value = bookingData.oraConsegna;
      }
      
      if (bookingData.destinazione) {
        const destinazione = qsId('destinazione');
        if (destinazione) destinazione.value = bookingData.destinazione;
      }
      
      showToast('[SAVE] Bozza ripristinata', 'info');
    }
  } catch (error) {
    console.error('Error loading draft:', error);
  }
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
// INIT & DOM READY
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  checkExistingSession();
  loadDraftData();
  initAutoSave();
  initVoiceInput();
  initContrastMode();
});

function initializeApp() {
  // Login form
  const loginForm = qsId('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Logout
  const logoutBtn = qsId('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // New customer CTA
  const newCustomerCTA = qsId('new-customer-cta');
  if (newCustomerCTA) {
    newCustomerCTA.addEventListener('click', handleNewCustomerCTA);
  }

  // Tab navigation
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // Wizard navigation
  setupWizardNavigation();

  // Preventivo buttons
  const callBtn = qsId('call-btn');
  if (callBtn) callBtn.addEventListener('click', handleCallPreventivo);
  
  const whatsappBtn = qsId('whatsapp-btn');
  if (whatsappBtn) whatsappBtn.addEventListener('click', handleWhatsAppPreventivo);

  // Refresh actions
  const refreshBtn = qsId('refresh-bookings');
  if (refreshBtn) refreshBtn.addEventListener('click', loadUserBookings);

  // Tab switcher buttons
  document.querySelectorAll('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab-switch'));
    });
  });

  console.log('[OK] App initialized with v7.0.1 COMPLETE');
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

function checkExistingSession() {
  const savedCF = localStorage.getItem(FRONTEND_CONFIG.storage.CF);
  if (savedCF && isValidCF(savedCF)) {
    const cfInput = qsId('cf-input');
    if (cfInput) cfInput.value = savedCF;
  }
  
  // Check preventivo status
  checkPreventivoStatus();
}

// Make functions globally accessible
window.removeDriver = removeDriver;

console.log('%c[OK] Scripts v7.0.1 COMPLETE loaded - All functions restored!', 'color: #28a745; font-weight: bold;');
