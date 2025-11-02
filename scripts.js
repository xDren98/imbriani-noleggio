/* ================================================================================
   IMBRIANI NOLEGGIO - MAIN SCRIPTS v8.0 (Complete & Fixed)
   All working functionality restored with proper coordination
   ================================================================================ */

'use strict';

const VERSION = '8.0.0';
const PHONE_NUMBER = '3286589618';
const MAX_WHATSAPP_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;

let clienteCorrente = null;
let prenotazioniUtente = [];
let availableVehicles = [];
let stepAttuale = 1;
let bookingData = {};
let preventivoRequested = false;
let whatsappTimestamps = [];
let voiceRecognition = null;

console.log(`%c🚐 Imbriani Noleggio v${VERSION} loaded`, 'font-size: 14px; font-weight: bold; color: #3f7ec7;');

// =====================
// INITIALIZATION
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  checkExistingSession();
  initVoiceInput();
  initContrastMode();
});

function initializeApp() {
  console.log('🚀 Initializing app...');
  
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
  
  // Tab switcher buttons (from empty states)
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
  
  console.log('✅ App initialized successfully');
}

// =====================
// VALIDATION
// =====================
function isValidCF(cf) {
  if (!cf || typeof cf !== 'string') return false;
  const cleaned = cf.toUpperCase().trim();
  if (cleaned.length !== 16) return false;
  return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(cleaned);
}

// =====================
// AUTHENTICATION
// =====================
async function handleLogin(e) {
  e.preventDefault();
  
  const cfInput = document.getElementById('cf-input');
  if (!cfInput) return;
  
  const cf = cfInput.value.toUpperCase().trim();
  
  if (!isValidCF(cf)) {
    showToast('❌ Codice fiscale non valido (16 caratteri)', 'error');
    return;
  }
  
  // Show loading state on button
  const submitBtn = e.target.querySelector('button[type="submit"]');
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
      
      // Show dashboard
      showUserDashboard();
      
      // Update user name in UI
      const userName = document.getElementById('user-name');
      if (userName) userName.textContent = clienteCorrente.name;
      
      // Load user data
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
  bookingData = {};
  
  // Clear session
  localStorage.removeItem('imbriani_user_session');
  localStorage.removeItem('BOOKING_DRAFT');
  localStorage.removeItem('PREVENTIVO_REQUESTED');
  
  // Reset UI
  showHomepage();
  
  // Clear form
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
    
    const userName = document.getElementById('user-name');
    if (userName) userName.textContent = sessionData.name;
    
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
}

function handleNewCustomerCTA() {
  // Show dashboard and switch to new booking tab
  showUserDashboard();
  switchTab('nuovo');
  
  // Initialize booking wizard with tomorrow's dates
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  bookingData = {
    dataRitiro: tomorrow.toISOString().split('T')[0],
    oraRitiro: '08:00',
    dataConsegna: dayAfter.toISOString().split('T')[0],
    oraConsegna: '20:00'
  };
  
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
  
  // Tab-specific initialization
  if (tabName === 'prenotazioni') {
    if (clienteCorrente) {
      loadUserBookings();
    }
  } else if (tabName === 'nuovo') {
    initializeNewBookingTab();
  } else if (tabName === 'profilo') {
    if (clienteCorrente) {
      loadUserProfile();
    }
  }
}

// =====================
// NEW BOOKING TAB
// =====================
function initializeNewBookingTab() {
  const wizardContainer = document.querySelector('.booking-wizard');
  if (!wizardContainer) return;
  
  wizardContainer.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>🎯 Nuova Prenotazione</h3>
        <p>Compila i dati per richiedere un preventivo</p>
      </div>
      <div class="card-body">
        <form id="booking-form" class="booking-form">
          <div class="form-grid">
            <div class="form-group">
              <label for="new-data-ritiro">📅 Data Ritiro</label>
              <input type="date" id="new-data-ritiro" class="form-input" required>
            </div>
            <div class="form-group">
              <label for="new-ora-ritiro">⏰ Ora Ritiro</label>
              <select id="new-ora-ritiro" class="form-input" required>
                <option value="">Seleziona...</option>
                ${generateTimeOptions()}
              </select>
            </div>
            <div class="form-group">
              <label for="new-data-consegna">📅 Data Consegna</label>
              <input type="date" id="new-data-consegna" class="form-input" required>
            </div>
            <div class="form-group">
              <label for="new-ora-consegna">⏰ Ora Consegna</label>
              <select id="new-ora-consegna" class="form-input" required>
                <option value="">Seleziona...</option>
                ${generateTimeOptions()}
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label for="new-destinazione">🎯 Destinazione</label>
            <div class="input-with-button">
              <input type="text" id="new-destinazione" class="form-input" 
                     placeholder="Dove vuoi andare?" required>
              <button type="button" id="voice-btn" class="btn btn-outline voice-btn" title="Registrazione vocale">
                🎤
              </button>
            </div>
            <small class="input-hint">Indica la destinazione principale del viaggio</small>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-large">
              🔍 Verifica Disponibilità
            </button>
          </div>
        </form>
        
        <!-- Available vehicles will be shown here -->
        <div id="vehicles-section" class="vehicles-section hidden">
          <h4>🚐 Pulmini Disponibili</h4>
          <div id="vehicles-grid" class="vehicles-grid"></div>
        </div>
        
        <!-- Booking summary and contact -->
        <div id="booking-summary-section" class="booking-summary-section hidden">
          <div class="summary-card">
            <h4>📋 Riepilogo Prenotazione</h4>
            <div id="booking-summary-content"></div>
          </div>
          
          <div class="contact-options">
            <h5>📞 Richiedi Preventivo</h5>
            <div class="contact-grid">
              <button id="call-preventivo" class="btn btn-success btn-large">
                📞 Chiama Ora
              </button>
              <button id="whatsapp-preventivo" class="btn btn-primary btn-large">
                📱 WhatsApp
              </button>
            </div>
            <div id="preventivo-status" class="success-message hidden">
              ✅ <strong>Preventivo richiesto!</strong> Riceverai risposta entro 2 ore.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Pre-fill dates if available
  if (bookingData.dataRitiro) {
    document.getElementById('new-data-ritiro').value = bookingData.dataRitiro;
    document.getElementById('new-ora-ritiro').value = bookingData.oraRitiro || '';
    document.getElementById('new-data-consegna').value = bookingData.dataConsegna;
    document.getElementById('new-ora-consegna').value = bookingData.oraConsegna || '';
  }
  
  // Setup form handler
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookingFormSubmit);
  }
  
  // Setup voice input
  const voiceBtn = document.getElementById('voice-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', handleVoiceInput);
  }
}

function generateTimeOptions() {
  const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
                 '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  return times.map(time => `<option value="${time}">${time}</option>`).join('');
}

async function handleBookingFormSubmit(e) {
  e.preventDefault();
  
  const formData = {
    dataRitiro: document.getElementById('new-data-ritiro').value,
    oraRitiro: document.getElementById('new-ora-ritiro').value,
    dataConsegna: document.getElementById('new-data-consegna').value,
    oraConsegna: document.getElementById('new-ora-consegna').value,
    destinazione: document.getElementById('new-destinazione').value.trim()
  };
  
  // Validation
  if (!formData.dataRitiro || !formData.oraRitiro || !formData.dataConsegna || 
      !formData.oraConsegna || !formData.destinazione) {
    showToast('❌ Compila tutti i campi', 'error');
    return;
  }
  
  const startDateTime = new Date(`${formData.dataRitiro}T${formData.oraRitiro}:00`);
  const endDateTime = new Date(`${formData.dataConsegna}T${formData.oraConsegna}:00`);
  
  if (startDateTime >= endDateTime) {
    showToast('❌ Data/ora consegna deve essere dopo il ritiro', 'error');
    return;
  }
  
  if (startDateTime < new Date()) {
    showToast('❌ La data di ritiro deve essere futura', 'error');
    return;
  }
  
  // Save data
  bookingData = formData;
  localStorage.setItem('BOOKING_DRAFT', JSON.stringify(bookingData));
  
  // Load available vehicles
  await loadAvailableVehicles();
}

// =====================
// VEHICLE MANAGEMENT
// =====================
async function loadAvailableVehicles() {
  const vehiclesSection = document.getElementById('vehicles-section');
  const vehiclesGrid = document.getElementById('vehicles-grid');
  
  if (!vehiclesSection || !vehiclesGrid) return;
  
  vehiclesSection.classList.remove('hidden');
  vehiclesGrid.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Caricamento veicoli...</p></div>';
  
  try {
    const response = await callAPI('getAvailableVehicles', {
      dataInizio: bookingData.dataRitiro,
      dataFine: bookingData.dataConsegna
    });
    
    if (response.success && response.data && response.data.length > 0) {
      availableVehicles = response.data;
      renderVehicles();
    } else {
      vehiclesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚐</div>
          <h4>Nessun pulmino disponibile</h4>
          <p>Per le date selezionate non ci sono veicoli disponibili</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading vehicles:', error);
    vehiclesGrid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">❌</div>
        <h4>Errore di connessione</h4>
        <p>Impossibile caricare i veicoli disponibili</p>
        <button class="btn btn-primary" onclick="loadAvailableVehicles()">🔄 Riprova</button>
      </div>
    `;
  }
}

function renderVehicles() {
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
    </div>
  `).join('');
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
  
  event.target.closest('.vehicle-card').classList.add('selected');
  
  showToast(`✅ Selezionato: ${targa}`, 'success');
  
  // Show booking summary
  showBookingSummary();
  
  localStorage.setItem('BOOKING_DRAFT', JSON.stringify(bookingData));
}

// =====================
// BOOKING SUMMARY & PREVENTIVO
// =====================
function showBookingSummary() {
  const summarySection = document.getElementById('booking-summary-section');
  const summaryContent = document.getElementById('booking-summary-content');
  
  if (!summarySection || !summaryContent) return;
  
  summarySection.classList.remove('hidden');
  
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
  
  summaryContent.innerHTML = `
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
  `;
  
  // Setup contact buttons
  const callBtn = document.getElementById('call-preventivo');
  const whatsappBtn = document.getElementById('whatsapp-preventivo');
  
  if (callBtn) callBtn.addEventListener('click', handleCallPreventivo);
  if (whatsappBtn) whatsappBtn.addEventListener('click', handleWhatsAppPreventivo);
}

function buildPreventivoMessage() {
  const { dataRitiro, oraRitiro, dataConsegna, oraConsegna, destinazione, targa, selectedVehicle } = bookingData;
  
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
  
  // ASCII-only message for WhatsApp compatibility
  return `PREVENTIVO PULMINO IMBRIANI\n===========================\nDal: ${formatDate(dataRitiro)} alle ${oraRitiro}\nAl: ${formatDate(dataConsegna)} alle ${oraConsegna}\nDestinazione: ${destinazione}\nPulmino: ${targa} (${posti} posti)\nDurata: ${durationText}\n===========================\nContatto: ${PHONE_NUMBER}\nGrazie!`;
}

function handleCallPreventivo() {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour < 8 || hour > 21) {
    showToast('⚠️ Orario di contatto: 8:00 - 21:00', 'warning');
  }
  
  window.open(`tel:+39${PHONE_NUMBER}`);
  markPreventivoRequested();
  showToast('📞 Apertura dialer...', 'info');
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
  showToast('📱 WhatsApp aperto!', 'success');
}

function markPreventivoRequested() {
  preventivoRequested = true;
  localStorage.setItem('PREVENTIVO_REQUESTED', '1');
  
  const statusDiv = document.getElementById('preventivo-status');
  if (statusDiv) {
    statusDiv.classList.remove('hidden');
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
  
  bookingsList.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Caricamento prenotazioni...</p>
    </div>
  `;
  
  try {
    let response;
    
    if (clienteCorrente && clienteCorrente.CF) {
      response = await callAPI('getUserBookings', { cf: clienteCorrente.CF });
    } else {
      // Demo data for anonymous users
      response = {
        success: true,
        data: []
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
    console.error('Error loading bookings:', error);
    bookingsList.innerHTML = `
      <div class="error-state">
        <div class="error-icon">❌</div>
        <h4>Errore di connessione</h4>
        <p>Impossibile caricare le prenotazioni</p>
        <button class="btn btn-primary" onclick="loadUserBookings()">🔄 Riprova</button>
      </div>
    `;
  }
}

function renderUserBookings() {
  const bookingsList = document.getElementById('prenotazioni-list');
  if (!bookingsList) return;
  
  bookingsList.innerHTML = prenotazioniUtente.map(booking => {
    const statusClass = getStatusBadgeClass(booking.Stato);
    
    return `
      <div class="booking-card">
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
// USER PROFILE
// =====================
function loadUserProfile() {
  const profileForm = document.getElementById('profile-form');
  if (!profileForm || !clienteCorrente) return;
  
  profileForm.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>👤 Nome</label>
        <input type="text" class="form-input" value="${clienteCorrente.name || 'Cliente Demo'}" readonly>
      </div>
      <div class="form-group">
        <label>🆔 Codice Fiscale</label>
        <input type="text" class="form-input" value="${clienteCorrente.CF || ''}" readonly>
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
// VOICE INPUT
// =====================
function initVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('⚠️ Voice recognition not supported');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = 'it-IT';
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;
  
  voiceRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const destinazioneInput = document.getElementById('new-destinazione');
    if (destinazioneInput) {
      destinazioneInput.value = transcript;
      showToast(`🎤 Registrato: ${transcript}`, 'success');
    }
  };
  
  voiceRecognition.onerror = () => {
    showToast('❌ Errore registrazione vocale', 'error');
  };
}

function handleVoiceInput() {
  if (voiceRecognition) {
    const voiceBtn = document.getElementById('voice-btn');
    voiceBtn.classList.add('recording');
    showToast('🎤 Parla ora...', 'info', 3000);
    voiceRecognition.start();
    
    setTimeout(() => {
      voiceBtn.classList.remove('recording');
    }, 5000);
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
  }
  
  contrastToggle.addEventListener('click', () => {
    const isEnabled = document.body.classList.toggle('high-contrast');
    localStorage.setItem('contrast-mode', isEnabled ? '1' : '0');
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
window.loadUserBookings = loadUserBookings;
window.loadAvailableVehicles = loadAvailableVehicles;

console.log('%c✅ Scripts v8.0 loaded successfully!', 'color: #22c55e; font-weight: bold;');