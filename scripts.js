/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - scripts.js v5.4.0 (static + GAS)
   Frontend Wizard Prenotazioni + Area Personale
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const VERSION = '5.4.0';
const BUILD_DATE = '2025-10-31';

let clienteCorrente = null;
let prenotazioniUtente = [];
let step_attuale = 1;
let booking_data = {};
let selectedBookingId = null;

console.log(`%c🎉 Imbriani Noleggio v${VERSION}`, 'font-size: 14px; font-weight: bold; color: #007f17;');

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  checkExistingSession();
});

function initializeUI() {
  const loginForm = qsId('login-form');
  const newBookingBtn = qsId('new-booking-btn');

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (newBookingBtn) newBookingBtn.addEventListener('click', showNewBookingWizard);

  // Tab switching
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // Logout
  const logoutBtn = qsId('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Wizard navigation
  setupWizardNavigation();

  // Refresh bookings
  const refreshBtn = qsId('refresh-bookings');
  if (refreshBtn) refreshBtn.addEventListener('click', loadUserBookings);

  console.log('🔧 UI initialized');
}

function setupWizardNavigation() {
  const steps = {
    'step1-next': () => validateAndGoToStep(2),
    'step2-back': () => goToStep(1),
    'step2-next': () => validateAndGoToStep(3),
    'step3-back': () => goToStep(2),
    'step3-next': () => validateAndGoToStep(4),
    'step4-back': () => goToStep(3),
    'step4-confirm': () => submitBooking()
  };

  Object.entries(steps).forEach(([id, fn]) => {
    const btn = qsId(id);
    if (btn) btn.addEventListener('click', fn);
  });

  // Add driver button
  const addBtn = qsId('add-autista');
  if (addBtn) addBtn.addEventListener('click', addDriver);
}

function checkExistingSession() {
  const savedCF = localStorage.getItem(FRONTEND_CONFIG.storage.CF);
  if (savedCF && isValidCF(savedCF)) {
    qsId('cf-input').value = savedCF;
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
    showToast('Codice Fiscale non valido (16 caratteri)', 'danger');
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
      await loadUserBookings();
      
      showToast('Accesso effettuato!', 'success');
    } else {
      showToast(response.message || 'Errore di accesso', 'danger');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Errore di connessione', 'danger');
  } finally {
    showLoader(false);
  }
}

function handleLogout() {
  clienteCorrente = null;
  prenotazioniUtente = [];
  localStorage.removeItem(FRONTEND_CONFIG.storage.CF);
  localStorage.removeItem(FRONTEND_CONFIG.storage.USER_DATA);
  
  qsId('login-section').classList.remove('hidden');
  qsId('user-dashboard').classList.add('hidden');
  qsId('cf-input').value = '';
  
  showToast('Disconnesso', 'info');
}

function showUserDashboard() {
  qsId('login-section').classList.add('hidden');
  qsId('user-dashboard').classList.remove('hidden');
  
  const userName = qsId('user-name');
  if (userName && clienteCorrente) {
    userName.textContent = clienteCorrente.Nome || 'Cliente';
  }
}

// =====================
// TAB MANAGEMENT
// =====================
function switchTab(tabName) {
  // Update buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  
  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });

  // Load tab-specific data
  if (tabName === 'prenotazioni') {
    loadUserBookings();
  } else if (tabName === 'profilo') {
    loadUserProfile();
  } else if (tabName === 'nuovo') {
    resetWizard();
  }
}

// =====================
// DATA LOADING
// =====================
async function loadUserBookings() {
  if (!clienteCorrente) return;
  
  showLoader(true);
  
  try {
    const response = await callAPI('recuperaPrenotazioni', { cf: clienteCorrente.CF });
    
    if (response.success) {
      prenotazioniUtente = response.data || [];
      renderUserBookings();
    } else {
      showToast(response.message || 'Errore caricamento prenotazioni', 'danger');
    }
  } catch (error) {
    console.error('Load bookings error:', error);
    showToast('Errore di connessione', 'danger');
  } finally {
    showLoader(false);
  }
}

function renderUserBookings() {
  const bookingsList = qsId('prenotazioni-list');
  const emptyState = qsId('empty-bookings');
  
  if (!bookingsList) return;
  
  if (!prenotazioniUtente.length) {
    bookingsList.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  
  if (emptyState) emptyState.classList.add('hidden');
  
  bookingsList.innerHTML = prenotazioniUtente.map(booking => {
    const statusEmoji = FRONTEND_CONFIG.statiEmoji[booking.Stato] || '❓';
    return `
      <div class="booking-item">
        <div class="booking-header">
          <span class="booking-id">#${booking.ID}</span>
          <span class="booking-status ${booking.Stato.toLowerCase()}">${statusEmoji} ${booking.Stato}</span>
        </div>
        <div class="booking-info">
          <div>📅 ${booking.DataRitiro} ${booking.OraRitiro} → ${booking.DataConsegna} ${booking.OraConsegna}</div>
          <div>🎯 ${booking.Destinazione}</div>
          <div>🚗 ${booking.Targa || 'Veicolo da assegnare'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// =====================
// WIZARD
// =====================
function resetWizard() {
  step_attuale = 1;
  booking_data = {};
  goToStep(1);
  
  // Clear form fields
  const fields = ['data-ritiro', 'ora-ritiro', 'data-consegna', 'ora-consegna', 'destinazione'];
  fields.forEach(id => {
    const el = qsId(id);
    if (el) el.value = '';
  });
  
  // Load available vehicles
  loadAvailableVehicles();
}

function goToStep(stepNum) {
  // Update progress
  document.querySelectorAll('.progress-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 <= stepNum);
  });
  
  // Update step content
  document.querySelectorAll('.wizard-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === stepNum);
  });
  
  step_attuale = stepNum;
}

function validateAndGoToStep(stepNum) {
  if (stepNum === 2) {
    // Validate step 1
    const required = ['data-ritiro', 'ora-ritiro', 'data-consegna', 'ora-consegna', 'destinazione'];
    const missing = required.filter(id => !qsId(id).value);
    
    if (missing.length) {
      showToast('Compila tutti i campi obbligatori', 'warning');
      return;
    }
    
    // Save booking data
    booking_data = {
      dataRitiro: qsId('data-ritiro').value,
      oraRitiro: qsId('ora-ritiro').value,
      dataConsegna: qsId('data-consegna').value,
      oraConsegna: qsId('ora-consegna').value,
      destinazione: qsId('destinazione').value
    };
  }
  
  if (stepNum === 3) {
    // Validate step 2 - vehicle selection
    if (!booking_data.targa) {
      showToast('Seleziona un veicolo', 'warning');
      return;
    }
  }
  
  if (stepNum === 4) {
    // Validate step 3 - drivers
    const drivers = collectDriverData();
    if (!drivers.length) {
      showToast('Aggiungi almeno un autista', 'warning');
      return;
    }
    booking_data.drivers = drivers;
    updateBookingSummary();
  }
  
  goToStep(stepNum);
}

async function loadAvailableVehicles() {
  showLoader(true);
  
  try {
    const response = await callAPI('disponibilita');
    
    if (response.success) {
      renderVehicles(response.data || []);
    } else {
      showToast(response.message || 'Errore caricamento veicoli', 'danger');
    }
  } catch (error) {
    console.error('Load vehicles error:', error);
    showToast('Errore di connessione', 'danger');
  } finally {
    showLoader(false);
  }
}

function renderVehicles(vehicles) {
  const vehiclesList = qsId('veicoli-list');
  if (!vehiclesList) return;
  
  if (!vehicles.length) {
    vehiclesList.innerHTML = '<p class="empty-message">Nessun veicolo disponibile</p>';
    return;
  }
  
  vehiclesList.innerHTML = vehicles.map(vehicle => `
    <div class="vehicle-card" onclick="selectVehicle('${vehicle.Targa}', this)">
      <div class="vehicle-header">
        <strong>${vehicle.Targa}</strong>
      </div>
      <div class="vehicle-details">
        <div>${vehicle.Marca} ${vehicle.Modello}</div>
        <div>👥 ${vehicle.Posti} posti</div>
        ${vehicle.Note ? `<div class="vehicle-note">${vehicle.Note}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function selectVehicle(targa, element) {
  document.querySelectorAll('.vehicle-card').forEach(card => {
    card.classList.remove('active');
  });
  element.classList.add('active');
  
  booking_data.targa = targa;
  
  const nextBtn = qsId('step2-next');
  if (nextBtn) nextBtn.disabled = false;
}

// =====================
// DRIVERS MANAGEMENT
// =====================
function addDriver() {
  const driversContainer = qsId('autisti-container');
  const currentCount = driversContainer.children.length;
  
  if (currentCount >= FRONTEND_CONFIG.validation.MAX_AUTISTI) {
    showToast('Massimo 3 autisti', 'warning');
    return;
  }
  
  const driverDiv = document.createElement('div');
  driverDiv.className = 'driver-form';
  driverDiv.innerHTML = `
    <div class="driver-header">
      <h5>Autista ${currentCount + 1}</h5>
      ${currentCount > 0 ? `<button type="button" class="btn btn-sm btn-outline" onclick="removeDriver(this)">❌ Rimuovi</button>` : ''}
    </div>
    <div class="driver-fields">
      <div class="form-row">
        <div class="form-group">
          <input type="text" placeholder="Nome" class="driver-nome" required>
        </div>
        <div class="form-group">
          <input type="text" placeholder="Cognome" class="driver-cognome" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <input type="text" placeholder="Codice Fiscale" maxlength="16" class="driver-cf" required>
        </div>
        <div class="form-group">
          <input type="date" placeholder="Data di nascita" class="driver-data-nascita" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <input type="text" placeholder="Numero patente" class="driver-patente" required>
        </div>
        <div class="form-group">
          <input type="date" placeholder="Scadenza patente" class="driver-scadenza" required>
        </div>
      </div>
    </div>
  `;
  
  driversContainer.appendChild(driverDiv);
  updateDriverValidation();
}

function removeDriver(btn) {
  btn.closest('.driver-form').remove();
  updateDriverNumbers();
  updateDriverValidation();
}

function updateDriverNumbers() {
  document.querySelectorAll('.driver-form').forEach((form, index) => {
    const header = form.querySelector('.driver-header h5');
    if (header) header.textContent = `Autista ${index + 1}`;
  });
}

function updateDriverValidation() {
  const driversCount = document.querySelectorAll('.driver-form').length;
  const nextBtn = qsId('step3-next');
  if (nextBtn) {
    nextBtn.disabled = driversCount < FRONTEND_CONFIG.validation.MIN_AUTISTI;
  }
}

function collectDriverData() {
  const drivers = [];
  document.querySelectorAll('.driver-form').forEach(form => {
    const driver = {
      Nome: form.querySelector('.driver-nome').value,
      Cognome: form.querySelector('.driver-cognome').value,
      CF: form.querySelector('.driver-cf').value.toUpperCase(),
      DataNascita: form.querySelector('.driver-data-nascita').value,
      NumeroPatente: form.querySelector('.driver-patente').value,
      ScadenzaPatente: form.querySelector('.driver-scadenza').value
    };
    
    if (driver.Nome && driver.CF) {
      drivers.push(driver);
    }
  });
  return drivers;
}

// =====================
// BOOKING SUBMISSION
// =====================
function updateBookingSummary() {
  const summary = qsId('booking-summary');
  if (!summary) return;
  
  const { dataRitiro, oraRitiro, dataConsegna, oraConsegna, destinazione, targa, drivers } = booking_data;
  
  summary.innerHTML = `
    <div class="summary-section">
      <h4>Riepilogo Prenotazione</h4>
      <div class="summary-item"><strong>Periodo:</strong> ${dataRitiro} ${oraRitiro} → ${dataConsegna} ${oraConsegna}</div>
      <div class="summary-item"><strong>Destinazione:</strong> ${destinazione}</div>
      <div class="summary-item"><strong>Veicolo:</strong> ${targa}</div>
      <div class="summary-item"><strong>Autisti:</strong> ${drivers.length} persona/e</div>
    </div>
    <div class="summary-drivers">
      <h5>Dettagli Autisti:</h5>
      ${drivers.map((d, i) => `
        <div class="driver-summary">
          <strong>Autista ${i + 1}:</strong> ${d.Nome} ${d.Cognome} (${d.CF})
        </div>
      `).join('')}
    </div>
  `;
}

async function submitBooking() {
  showLoader(true);
  
  try {
    const payload = {
      cf: clienteCorrente.CF,
      dataRitiro: booking_data.dataRitiro,
      oraRitiro: booking_data.oraRitiro,
      dataConsegna: booking_data.dataConsegna,
      oraConsegna: booking_data.oraConsegna,
      targa: booking_data.targa,
      destinazione: booking_data.destinazione,
      drivers: encodeURIComponent(JSON.stringify(booking_data.drivers))
    };
    
    const response = await callAPI('creaPrenotazione', payload);
    
    if (response.success) {
      showToast('Prenotazione inviata con successo!', 'success');
      resetWizard();
      switchTab('prenotazioni');
      await loadUserBookings();
    } else {
      showToast(response.message || 'Errore durante la prenotazione', 'danger');
    }
  } catch (error) {
    console.error('Submit booking error:', error);
    showToast('Errore di connessione', 'danger');
  } finally {
    showLoader(false);
  }
}

// =====================
// PROFILE
// =====================
function loadUserProfile() {
  if (!clienteCorrente) return;
  
  const fields = {
    'profile-nome': clienteCorrente.Nome || '',
    'profile-email': clienteCorrente.Email || '',
    'profile-telefono': clienteCorrente.Cellulare || ''
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const el = qsId(id);
    if (el) el.value = value;
  });
}

// =====================
// UTILITIES
// =====================
function qsId(id) { return document.getElementById(id); }

function isValidCF(cf) {
  const cfUpper = String(cf || '').toUpperCase().trim();
  return cfUpper.length === FRONTEND_CONFIG.validation.CF_LENGTH && 
         /^[A-Z0-9]+$/.test(cfUpper);
}

function showNewBookingWizard() {
  switchTab('nuovo');
  resetWizard();
}

// Initialize first driver on load
setTimeout(() => {
  const container = qsId('autisti-container');
  if (container && !container.children.length) {
    addDriver();
  }
}, 100);

console.log('%c🔧 Scripts loaded successfully', 'color: #28a745; font-weight: bold;');
