/* ================================================================================
   IMBRIANI NOLEGGIO - MAIN SCRIPTS v8.0 (Anthracite/Azure Enhanced)
   Complete site functionality with modern theme coordination
   ================================================================================ */

'use strict';

const VERSION = '8.0.0';
const PHONE_NUMBER = '3286589618';
const MAX_WHATSAPP_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes

let clienteCorrente = null;
let prenotazioniUtente = [];
let availableVehicles = [];
let stepAttuale = 1;
let bookingData = {};
let preventivoRequested = false;
let whatsappTimestamps = [];
let voiceRecognition = null;

console.log(`%c🚐 Imbriani Noleggio v${VERSION} (Anthracite/Azure Theme)`, 'font-size: 16px; font-weight: bold; color: #3f7ec7;');

// =====================
// INITIALIZATION
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  checkExistingSession();
  initVoiceInput();
  initContrastMode();
  
  console.log('🎨 Theme: Anthracite/Azure coordination active');
});

function initializeApp() {
  console.log('🚀 Initializing Imbriani Noleggio v8.0...');
  
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // New customer CTA
  const newCustomerCTA = document.getElementById('new-customer-cta');
  if (newCustomerCTA) {
    newCustomerCTA.addEventListener('click', handleNewCustomerCTA);
  }
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });
  
  // Tab switcher buttons
  document.querySelectorAll('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab-switch');
      if (tabName) switchTab(tabName);
    });
  });
  
  // Refresh bookings
  const refreshBtn = document.getElementById('refresh-bookings');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadUserBookings);
  }
  
  console.log('✅ App initialization complete');
}

// =====================
// AUTHENTICATION
// =====================
function isValidCF(cf) {
  if (!cf || typeof cf !== 'string') return false;
  const cleaned = cf.toUpperCase().trim();
  if (cleaned.length !== 16) return false;
  return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(cleaned);
}

async function handleLogin(e) {
  e.preventDefault();
  
  const cfInput = document.getElementById('cf-input');
  if (!cfInput) return;
  
  const cf = cfInput.value.toUpperCase().trim();
  
  if (!isValidCF(cf)) {
    showToast('❌ Codice fiscale non valido (16 caratteri)', 'error');
    return;
  }
  
  // Show loading state
  const submitBtn = cfInput.closest('form').querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');
  
  if (btnText) btnText.classList.add('hidden');
  if (btnSpinner) btnSpinner.classList.remove('hidden');
  submitBtn.disabled = true;
  
  try {
    const response = await callAPI('loginWithCF', { cf });
    
    if (response.success) {
      clienteCorrente = response.user;
      
      // Save session
      localStorage.setItem('imbriani_user_session', JSON.stringify({
        cf: cf,
        name: clienteCorrente.name,
        timestamp: Date.now()
      }));
      
      showToast(`✅ Benvenuto ${clienteCorrente.name}!`, 'success');
      
      // Switch to dashboard
      showUserDashboard();
      
      // Load user bookings
      await loadUserBookings();
      
    } else {
      showToast(`❌ ${response.message || 'Errore login'}`, 'error');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    showToast('❌ Errore di connessione', 'error');
  } finally {
    // Reset button state
    if (btnText) btnText.classList.remove('hidden');
    if (btnSpinner) btnSpinner.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

function handleLogout() {
  clienteCorrente = null;
  prenotazioniUtente = [];
  
  // Clear session
  localStorage.removeItem('imbriani_user_session');
  localStorage.removeItem('BOOKING_DRAFT');
  localStorage.removeItem('PREVENTIVO_REQUESTED');
  
  // Reset UI
  showHomepage();
  
  // Clear CF input
  const cfInput = document.getElementById('cf-input');
  if (cfInput) cfInput.value = '';
  
  showToast('🔓 Disconnesso', 'info');
}

function checkExistingSession() {
  try {
    const session = localStorage.getItem('imbriani_user_session');
    if (!session) return;
    
    const sessionData = JSON.parse(session);
    
    // Check if session is still valid (24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - sessionData.timestamp > maxAge) {
      localStorage.removeItem('imbriani_user_session');
      return;
    }
    
    // Restore session
    clienteCorrente = {
      CF: sessionData.cf,
      name: sessionData.name
    };
    
    showUserDashboard();
    loadUserBookings();
    
    console.log('🔄 Session restored for:', sessionData.name);
    
  } catch (error) {
    console.error('Session restore error:', error);
    localStorage.removeItem('imbriani_user_session');
  }
}

// =====================
// UI STATE MANAGEMENT
// =====================
function showHomepage() {
  const homepageSections = document.getElementById('homepage-sections');
  const dashboard = document.getElementById('user-dashboard');
  
  if (homepageSections) homepageSections.classList.remove('hidden');
  if (dashboard) dashboard.classList.add('hidden');
}

function showUserDashboard() {
  const homepageSections = document.getElementById('homepage-sections');
  const dashboard = document.getElementById('user-dashboard');
  
  if (homepageSections) homepageSections.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  
  // Update user info
  const userName = document.getElementById('user-name');
  if (userName && clienteCorrente) {
    userName.textContent = clienteCorrente.name || 'Cliente';
  }
}

function handleNewCustomerCTA() {
  // Pre-fill dates with tomorrow and day after
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  // Initialize booking data
  bookingData = {
    dataRitiro: tomorrow.toISOString().split('T')[0],
    oraRitiro: '08:00',
    dataConsegna: dayAfter.toISOString().split('T')[0],
    oraConsegna: '20:00',
    destinazione: ''
  };
  
  // Show dashboard and switch to new booking tab
  showUserDashboard();
  switchTab('nuovo');
  
  showToast('📅 Date preimpostate per domani!', 'info');
}

// =====================
// TAB MANAGEMENT
// =====================
function switchTab(tabName) {
  console.log(`📋 Switching to tab: ${tabName}`);
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  
  // Update tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
  
  // Tab-specific logic
  if (tabName === 'prenotazioni' && clienteCorrente) {
    loadUserBookings();
  } else if (tabName === 'nuovo') {
    initializeBookingWizard();
  } else if (tabName === 'profilo' && clienteCorrente) {
    loadUserProfile();
  }
}

// =====================
// BOOKING WIZARD
// =====================
function initializeBookingWizard() {
  const wizardContainer = document.querySelector('.booking-wizard');
  if (!wizardContainer) return;
  
  wizardContainer.innerHTML = `
    <div class="wizard-header">
      <h3>🎯 Nuova Prenotazione</h3>
      <div class="wizard-progress">
        <div class="progress-step active">1</div>
        <div class="progress-step">2</div>
        <div class="progress-step">3</div>
      </div>
    </div>
    
    <div class="wizard-content">
      <!-- Step 1: Date Selection -->
      <div id="wizard-step-1" class="wizard-step active">
        <div class="card">
          <div class="card-header">
            <h4>📅 Seleziona Date e Orari</h4>
          </div>
          <div class="card-body">
            <div class="form-grid">
              <div class="form-group">
                <label for="wizard-data-ritiro">📅 Data Ritiro</label>
                <input type="date" id="wizard-data-ritiro" class="form-input" required>
              </div>
              <div class="form-group">
                <label for="wizard-ora-ritiro">⏰ Ora Ritiro</label>
                <select id="wizard-ora-ritiro" class="form-input" required>
                  <option value="">Seleziona orario...</option>
                  <option value="08:00">08:00</option>
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="12:00">12:00</option>
                  <option value="13:00">13:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                  <option value="17:00">17:00</option>
                  <option value="18:00">18:00</option>
                  <option value="19:00">19:00</option>
                  <option value="20:00">20:00</option>
                </select>
              </div>
              <div class="form-group">
                <label for="wizard-data-consegna">📅 Data Consegna</label>
                <input type="date" id="wizard-data-consegna" class="form-input" required>
              </div>
              <div class="form-group">
                <label for="wizard-ora-consegna">⏰ Ora Consegna</label>
                <select id="wizard-ora-consegna" class="form-input" required>
                  <option value="">Seleziona orario...</option>
                  <option value="08:00">08:00</option>
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="12:00">12:00</option>
                  <option value="13:00">13:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                  <option value="17:00">17:00</option>
                  <option value="18:00">18:00</option>
                  <option value="19:00">19:00</option>
                  <option value="20:00">20:00</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label for="wizard-destinazione">🎯 Destinazione</label>
              <div class="input-with-voice">
                <input type="text" id="wizard-destinazione" class="form-input" 
                       placeholder="Dove vuoi andare?" required>
                <button type="button" id="voice-input-btn" class="btn btn-outline voice-btn" 
                        title="Registrazione vocale">🎤</button>
              </div>
              <small class="input-hint">Indica la destinazione principale del viaggio</small>
            </div>
            
            <div class="wizard-actions">
              <button type="button" id="wizard-step1-next" class="btn btn-azure btn-large">
                ➡️ Verifica Disponibilità
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Step 2: Vehicle Selection -->
      <div id="wizard-step-2" class="wizard-step">
        <div class="card">
          <div class="card-header">
            <h4>🚐 Pulmini Disponibili</h4>
          </div>
          <div class="card-body">
            <div id="vehicles-grid" class="vehicles-grid">
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Verifica disponibilità...</p>
              </div>
            </div>
            
            <div class="wizard-actions">
              <button type="button" id="wizard-step2-back" class="btn btn-outline">
                ⬅️ Indietro
              </button>
              <button type="button" id="wizard-step2-next" class="btn btn-azure btn-large" disabled>
                ➡️ Richiedi Preventivo
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Step 3: Quote Request -->
      <div id="wizard-step-3" class="wizard-step">
        <div class="card">
          <div class="card-header">
            <h4>💰 Richiesta Preventivo</h4>
          </div>
          <div class="card-body">
            <div class="booking-summary" id="booking-summary-preview"></div>
            
            <div class="contact-options">
              <div class="contact-option">
                <button type="button" id="call-preventivo" class="btn btn-success btn-large">
                  📞 Chiama Ora
                </button>
                <p>Parla direttamente con Stefano</p>
              </div>
              
              <div class="contact-option">
                <button type="button" id="whatsapp-preventivo" class="btn btn-azure btn-large">
                  📱 WhatsApp
                </button>
                <p>Invia richiesta via messaggio</p>
              </div>
            </div>
            
            <div id="preventivo-completed" class="success-state hidden">
              <div class="success-icon">✅</div>
              <h5>Preventivo Richiesto!</h5>
              <p>Riceverai risposta entro 2 ore durante l'orario lavorativo</p>
            </div>
            
            <div class="wizard-actions">
              <button type="button" id="wizard-step3-back" class="btn btn-outline">
                ⬅️ Indietro
              </button>
              <button type="button" id="wizard-step3-next" class="btn btn-azure btn-large" disabled>
                ➡️ Completa Prenotazione
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Setup wizard navigation
  setupWizardNavigation();
  
  // Pre-fill with existing data or defaults
  prefillWizardData();
}

function setupWizardNavigation() {
  // Step 1 -> 2
  document.getElementById('wizard-step1-next')?.addEventListener('click', () => {
    if (validateWizardStep1()) {
      goToWizardStep(2);
      loadAvailableVehicles();
    }
  });
  
  // Step 2 navigation
  document.getElementById('wizard-step2-back')?.addEventListener('click', () => goToWizardStep(1));
  document.getElementById('wizard-step2-next')?.addEventListener('click', () => {
    if (bookingData.selectedVehicle) {
      goToWizardStep(3);
      updateBookingSummary();
    }
  });
  
  // Step 3 navigation
  document.getElementById('wizard-step3-back')?.addEventListener('click', () => goToWizardStep(2));
  document.getElementById('wizard-step3-next')?.addEventListener('click', finalizeBooking);
  
  // Contact buttons
  document.getElementById('call-preventivo')?.addEventListener('click', handleCallPreventivo);
  document.getElementById('whatsapp-preventivo')?.addEventListener('click', handleWhatsAppPreventivo);
}

function prefillWizardData() {
  // Set tomorrow as default dates if no data exists
  if (!bookingData.dataRitiro) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    
    document.getElementById('wizard-data-ritiro').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('wizard-ora-ritiro').value = '08:00';
    document.getElementById('wizard-data-consegna').value = dayAfter.toISOString().split('T')[0];
    document.getElementById('wizard-ora-consegna').value = '20:00';
  } else {
    // Restore existing data
    document.getElementById('wizard-data-ritiro').value = bookingData.dataRitiro || '';
    document.getElementById('wizard-ora-ritiro').value = bookingData.oraRitiro || '';
    document.getElementById('wizard-data-consegna').value = bookingData.dataConsegna || '';
    document.getElementById('wizard-ora-consegna').value = bookingData.oraConsegna || '';
    document.getElementById('wizard-destinazione').value = bookingData.destinazione || '';
  }
}

function goToWizardStep(step) {
  console.log(`🔄 Going to wizard step ${step}`);
  
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(stepEl => {
    stepEl.classList.remove('active');
  });
  
  // Show target step
  const targetStep = document.getElementById(`wizard-step-${step}`);
  if (targetStep) {
    targetStep.classList.add('active');
  }
  
  // Update progress indicators
  document.querySelectorAll('.progress-step').forEach((progressStep, index) => {
    const stepNum = index + 1;
    progressStep.classList.toggle('active', stepNum === step);
    progressStep.classList.toggle('completed', stepNum < step);
  });
  
  stepAttuale = step;
}

function validateWizardStep1() {
  const dataRitiro = document.getElementById('wizard-data-ritiro')?.value;
  const oraRitiro = document.getElementById('wizard-ora-ritiro')?.value;
  const dataConsegna = document.getElementById('wizard-data-consegna')?.value;
  const oraConsegna = document.getElementById('wizard-ora-consegna')?.value;
  const destinazione = document.getElementById('wizard-destinazione')?.value?.trim();
  
  if (!dataRitiro || !oraRitiro || !dataConsegna || !oraConsegna || !destinazione) {
    showToast('❌ Compila tutti i campi', 'error');
    return false;
  }
  
  const startDateTime = new Date(`${dataRitiro}T${oraRitiro}:00`);
  const endDateTime = new Date(`${dataConsegna}T${oraConsegna}:00`);
  
  if (startDateTime >= endDateTime) {
    showToast('❌ Data/ora consegna deve essere dopo il ritiro', 'error');
    return false;
  }
  
  // Check if dates are in the future
  const now = new Date();
  if (startDateTime < now) {
    showToast('❌ La data di ritiro deve essere futura', 'error');
    return false;
  }
  
  // Save data
  bookingData = {
    ...bookingData,
    dataRitiro,
    oraRitiro,
    dataConsegna,
    oraConsegna,
    destinazione
  };
  
  localStorage.setItem('BOOKING_DRAFT', JSON.stringify(bookingData));
  return true;
}

// =====================
// VEHICLE MANAGEMENT
// =====================
async function loadAvailableVehicles() {
  const vehiclesGrid = document.getElementById('vehicles-grid');
  if (!vehiclesGrid) return;
  
  try {
    const response = await callAPI('getAvailableVehicles', {
      dataInizio: bookingData.dataRitiro,
      dataFine: bookingData.dataConsegna
    });
    
    if (response.success && response.data) {
      availableVehicles = response.data;
      renderAvailableVehicles();
    } else {
      vehiclesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚐</div>
          <h4>Nessun pulmino disponibile</h4>
          <p>Per le date selezionate non ci sono veicoli disponibili</p>
          <button class="btn btn-outline" onclick="goToWizardStep(1)">⬅️ Modifica Date</button>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading vehicles:', error);
    vehiclesGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <h4>Errore di connessione</h4>
        <p>Impossibile caricare i veicoli disponibili</p>
        <button class="btn btn-azure" onclick="loadAvailableVehicles()">🔄 Riprova</button>
      </div>
    `;
  }
}

function renderAvailableVehicles() {
  const vehiclesGrid = document.getElementById('vehicles-grid');
  if (!vehiclesGrid) return;
  
  vehiclesGrid.innerHTML = availableVehicles.map(vehicle => `
    <div class="vehicle-card ${bookingData.selectedVehicle?.Targa === vehicle.Targa ? 'selected' : ''}" 
         onclick="selectVehicle('${vehicle.Targa}')">
      <div class="vehicle-header">
        <h5>🚐 ${vehicle.Targa}</h5>
        <span class="badge badge-success">✅ Disponibile</span>
      </div>
      <div class="vehicle-info">
        <p><strong>${vehicle.Marca} ${vehicle.Modello}</strong></p>
        <p>👥 ${vehicle.Posti || 9} posti</p>
        <p>🎨 ${vehicle.Colore || 'Standard'}</p>
      </div>
      <div class="vehicle-features">
        <span class="feature">❄️ A/C</span>
        <span class="feature">📻 Radio</span>
        <span class="feature">🔌 USB</span>
      </div>
    </div>
  `).join('');
  
  // Update next button state
  const nextBtn = document.getElementById('wizard-step2-next');
  if (nextBtn) {
    nextBtn.disabled = !bookingData.selectedVehicle;
  }
}

function selectVehicle(targa) {
  const vehicle = availableVehicles.find(v => v.Targa === targa);
  if (!vehicle) return;
  
  bookingData.selectedVehicle = vehicle;
  bookingData.targa = targa;
  
  // Update UI
  document.querySelectorAll('.vehicle-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  document.querySelector(`[onclick="selectVehicle('${targa}')"]`)?.classList.add('selected');
  
  // Enable next button
  const nextBtn = document.getElementById('wizard-step2-next');
  if (nextBtn) {
    nextBtn.disabled = false;
  }
  
  showToast(`✅ Selezionato: ${targa}`, 'success');
  
  // Save to localStorage
  localStorage.setItem('BOOKING_DRAFT', JSON.stringify(bookingData));
}

// =====================
// PREVENTIVO MANAGEMENT
// =====================
function updateBookingSummary() {
  const summaryContainer = document.getElementById('booking-summary-preview');
  if (!summaryContainer) return;
  
  const startDate = new Date(`${bookingData.dataRitiro}T${bookingData.oraRitiro}:00`);
  const endDate = new Date(`${bookingData.dataConsegna}T${bookingData.oraConsegna}:00`);
  const diffMs = endDate - startDate;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  
  let durationText = '';
  if (days > 0 && hours > 0) durationText = `${days} giorno${days > 1 ? 'i' : ''}, ${hours} ore`;
  else if (days > 0) durationText = `${days} giorno${days > 1 ? 'i' : ''}`;
  else durationText = `${hours} ore`;
  
  summaryContainer.innerHTML = `
    <div class="summary-card">
      <h5>📋 Riepilogo Prenotazione</h5>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">📅 Ritiro:</span>
          <span class="summary-value">${formatDate(bookingData.dataRitiro)} alle ${bookingData.oraRitiro}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">📅 Consegna:</span>
          <span class="summary-value">${formatDate(bookingData.dataConsegna)} alle ${bookingData.oraConsegna}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">⏱️ Durata:</span>
          <span class="summary-value">${durationText}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">🎯 Destinazione:</span>
          <span class="summary-value">${bookingData.destinazione}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">🚐 Pulmino:</span>
          <span class="summary-value">${bookingData.targa} (${bookingData.selectedVehicle?.Posti || 9} posti)</span>
        </div>
      </div>
    </div>
  `;
}

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
  
  // ASCII-only message (no Unicode/emoji)
  return `PREVENTIVO PULMINO IMBRIANI
===========================
Dal: ${formatDate(dataRitiro)} alle ${oraRitiro}
Al: ${formatDate(dataConsegna)} alle ${oraConsegna}
Destinazione: ${destinazione}
Pulmino: ${targa} (${posti} posti)
Durata: ${durationText}
===========================
Contatto: ${PHONE_NUMBER}
Grazie!`;
}

function handleCallPreventivo() {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour < 8 || hour > 21) {
    showToast('⚠️ Orario di contatto: 8:00 - 21:00', 'warning');
  }
  
  window.open(`tel:+39${PHONE_NUMBER}`);
  markPreventivoRequested();
  showToast('📞 Apertura dialer... Dopo la chiamata torna qui!', 'info');
}

function handleWhatsAppPreventivo() {
  if (!checkRateLimit()) {
    const remaining = getRateLimitTimeRemaining();
    showToast(`⚠️ Limite WhatsApp raggiunto. Riprova tra ${remaining} minuti`, 'warning');
    return;
  }
  
  const message = buildPreventivoMessage();
  const encodedMessage = encodeURIComponent(message);
  const whatsappURL = `https://wa.me/39${PHONE_NUMBER}?text=${encodedMessage}`;
  
  whatsappTimestamps.push(Date.now());
  
  window.open(whatsappURL, '_blank');
  markPreventivoRequested();
  showToast('📱 WhatsApp aperto! Dopo invio torna qui', 'success');
}

function markPreventivoRequested() {
  preventivoRequested = true;
  localStorage.setItem('PREVENTIVO_REQUESTED', '1');
  
  const completedState = document.getElementById('preventivo-completed');
  if (completedState) {
    completedState.classList.remove('hidden');
  }
  
  const nextBtn = document.getElementById('wizard-step3-next');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.classList.add('btn-pulse');
  }
}

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

// =====================
// USER BOOKINGS
// =====================
async function loadUserBookings() {
  const bookingsList = document.getElementById('prenotazioni-list');
  const emptyState = document.getElementById('empty-bookings');
  
  if (!bookingsList) return;
  
  // Show loading state
  bookingsList.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Caricamento prenotazioni...</p>
    </div>
  `;
  
  try {
    let response;
    
    if (clienteCorrente) {
      response = await callAPI('getUserBookings', { cf: clienteCorrente.CF });
    } else {
      // Mock data for demo
      response = {
        success: true,
        data: [
          {
            ID: 'BOOK-2025-DEMO-001',
            DataCreazione: '2025-11-01',
            DataRitiro: '2025-11-03',
            OraRitiro: '08:00',
            DataConsegna: '2025-11-05',
            OraConsegna: '20:00',
            Destinazione: 'Roma Centro',
            Targa: 'DN391FW',
            Stato: 'Confermata'
          }
        ]
      };
    }
    
    if (response.success) {
      prenotazioniUtente = response.data || [];
      
      if (prenotazioniUtente.length === 0) {
        bookingsList.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        bookingsList.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        renderUserBookings();
      }
    } else {
      showToast('❌ Errore caricamento prenotazioni', 'error');
    }
    
  } catch (error) {
    console.error('Error loading user bookings:', error);
    bookingsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <h4>Errore di connessione</h4>
        <p>Impossibile caricare le prenotazioni</p>
        <button class="btn btn-azure" onclick="loadUserBookings()">🔄 Riprova</button>
      </div>
    `;
  }
}

function renderUserBookings() {
  const bookingsList = document.getElementById('prenotazioni-list');
  if (!bookingsList || !prenotazioniUtente) return;
  
  bookingsList.innerHTML = prenotazioniUtente.map(booking => {
    const statusClass = getStatusBadgeClass(booking.Stato);
    
    return `
      <div class="booking-card glass-card">
        <div class="booking-header">
          <h4>${booking.ID}</h4>
          <span class="status-badge ${statusClass}">${booking.Stato}</span>
        </div>
        <div class="booking-details">
          <div class="detail-row">
            <span class="detail-label">📅 Periodo:</span>
            <span class="detail-value">
              ${formatDate(booking.DataRitiro)} ${booking.OraRitiro} → 
              ${formatDate(booking.DataConsegna)} ${booking.OraConsegna}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🎯 Destinazione:</span>
            <span class="detail-value">${booking.Destinazione}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🚐 Pulmino:</span>
            <span class="detail-value">${booking.Targa || 'Da assegnare'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">📅 Creata il:</span>
            <span class="detail-value">${formatDate(booking.DataCreazione)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getStatusBadgeClass(status) {
  const statusMap = {
    'Confermata': 'status-confirmed',
    'Da confermare': 'status-pending',
    'Annullata': 'status-cancelled'
  };
  return statusMap[status] || 'status-pending';
}

// =====================
// PROFILE MANAGEMENT
// =====================
function loadUserProfile() {
  const profileForm = document.getElementById('profile-form');
  if (!profileForm || !clienteCorrente) return;
  
  profileForm.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label for="profile-nome">👤 Nome</label>
        <input type="text" id="profile-nome" class="form-input" 
               value="${clienteCorrente.nome || ''}" readonly>
      </div>
      <div class="form-group">
        <label for="profile-cognome">👤 Cognome</label>
        <input type="text" id="profile-cognome" class="form-input" 
               value="${clienteCorrente.cognome || ''}" readonly>
      </div>
      <div class="form-group">
        <label for="profile-cf">🆔 Codice Fiscale</label>
        <input type="text" id="profile-cf" class="form-input" 
               value="${clienteCorrente.CF || ''}" readonly>
      </div>
      <div class="form-group">
        <label for="profile-telefono">📱 Telefono</label>
        <input type="tel" id="profile-telefono" class="form-input" 
               value="${clienteCorrente.telefono || ''}" readonly>
      </div>
      <div class="form-group">
        <label for="profile-email">📧 Email</label>
        <input type="email" id="profile-email" class="form-input" 
               value="${clienteCorrente.email || ''}" readonly>
      </div>
    </div>
    
    <div class="profile-stats">
      <h5>📊 Statistiche</h5>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">${prenotazioniUtente.length}</span>
          <span class="stat-label">Prenotazioni Totali</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${prenotazioniUtente.filter(b => b.Stato === 'Confermata').length}</span>
          <span class="stat-label">Confermate</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${prenotazioniUtente.filter(b => b.Stato === 'Da confermare').length}</span>
          <span class="stat-label">In Attesa</span>
        </div>
      </div>
    </div>
    
    <div class="info-note">
      <div class="note-icon">ℹ️</div>
      <p>Per modificare i dati personali, contatta l'assistenza al <strong>${PHONE_NUMBER}</strong></p>
    </div>
  `;
}

// =====================
// FINALIZE BOOKING
// =====================
async function finalizeBooking() {
  if (!preventivoRequested) {
    showToast('❌ Prima richiedi il preventivo', 'error');
    return;
  }
  
  try {
    showToast('⏳ Finalizzazione prenotazione...', 'info');
    
    const bookingPayload = {
      cf: clienteCorrente?.CF || 'ANONYMOUS',
      ...bookingData
    };
    
    const response = await callAPI('createBooking', bookingPayload, 'POST');
    
    if (response.success) {
      showToast('✅ Prenotazione inviata con successo!', 'success');
      
      // Clear draft data
      localStorage.removeItem('BOOKING_DRAFT');
      localStorage.removeItem('PREVENTIVO_REQUESTED');
      
      // Reset state
      bookingData = {};
      preventivoRequested = false;
      
      // Switch to bookings tab
      switchTab('prenotazioni');
      loadUserBookings();
      
    } else {
      showToast(`❌ ${response.message || 'Errore invio prenotazione'}`, 'error');
    }
    
  } catch (error) {
    console.error('Finalize booking error:', error);
    showToast('❌ Errore di connessione', 'error');
  }
}

// =====================
// VOICE INPUT
// =====================
function initVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('⚠️ Voice recognition not supported');
    const voiceBtn = document.getElementById('voice-input-btn');
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
    const destinazioneInput = document.getElementById('wizard-destinazione');
    if (destinazioneInput) {
      destinazioneInput.value = transcript;
      showToast(`🎤 Registrato: ${transcript}`, 'success');
    }
  };
  
  voiceRecognition.onerror = () => {
    showToast('❌ Errore registrazione vocale', 'error');
  };
  
  const voiceBtn = document.getElementById('voice-input-btn');
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
  const contrastToggle = document.getElementById('contrast-toggle');
  if (!contrastToggle) return;
  
  const contrastEnabled = localStorage.getItem('contrast-mode') === '1';
  if (contrastEnabled) {
    document.body.classList.add('high-contrast');
    contrastToggle.innerHTML = '<span>👁</span>';
  }
  
  contrastToggle.addEventListener('click', () => {
    const isEnabled = document.body.classList.toggle('high-contrast');
    localStorage.setItem('contrast-mode', isEnabled ? '1' : '0');
    contrastToggle.innerHTML = `<span>${isEnabled ? '👁' : '👁'}</span>`;
    showToast(isEnabled ? '👁 Contrasto elevato attivo' : '👁 Contrasto normale', 'info');
  });
}

// =====================
// UTILITIES
// =====================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  
  try {
    return new Date(dateStr).toLocaleDateString('it-IT');
  } catch {
    return dateStr;
  }
}

function showLoader(show = true) {
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.classList.toggle('hidden', !show);
  }
}

// Global function exports
window.selectVehicle = selectVehicle;
window.goToWizardStep = goToWizardStep;
window.finalizeBooking = finalizeBooking;

console.log('%c✅ Scripts v8.0 fully loaded with Anthracite/Azure coordination!', 'color: #22c55e; font-weight: bold;');