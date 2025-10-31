/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - scripts.js v5.5.0
   + Nuovo cliente CTA "Verifica disponibilità"
   + Auto-fill Autista 1 da ultima prenotazione
   + Validazioni robuste + Salvataggio bozza
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const VERSION = '5.5.0';
let clienteCorrente = null;
let prenotazioniUtente = [];
let availableVehicles = [];
let stepAttuale = 1;
let bookingData = {};

console.log(`%c🎉 Imbriani Noleggio v${VERSION}`, 'font-size: 14px; font-weight: bold; color: #007f17;');

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  checkExistingSession();
});

function initializeApp() {
  // Login form
  const loginForm = qsId('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Tab navigation
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // Logout
  const logoutBtn = qsId('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Wizard navigation
  setupWizardNavigation();

  // Refresh actions
  const refreshBtn = qsId('refresh-bookings');
  if (refreshBtn) refreshBtn.addEventListener('click', loadUserBookings);

  // Quick tab switches from CTAs
  document.querySelectorAll('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.getAttribute('data-tab-switch');
      if (tab) switchTab(tab);
    });
  });

  console.log('🔧 App initialized');
}

function setupWizardNavigation() {
  const navigationMap = {
    'step1-next': () => validateAndGoToStep(2),
    'step2-back': () => goToStep(1),
    'step2-next': () => validateAndGoToStep(3),
    'step3-back': () => goToStep(2),
    'step3-next': () => validateAndGoToStep(4),
    'step4-back': () => goToStep(3),
    'step4-confirm': () => submitBooking(),
    'add-autista': () => addDriver()
  };

  Object.entries(navigationMap).forEach(([id, handler]) => {
    const element = qsId(id);
    if (element) element.addEventListener('click', handler);
  });

  // Form change listeners for auto-save draft
  const formFields = ['data-ritiro', 'ora-ritiro', 'data-consegna', 'ora-consegna', 'destinazione'];
  formFields.forEach(id => {
    const field = qsId(id);
    if (field) {
      field.addEventListener('change', saveDraftData);
      field.addEventListener('input', saveDraftData);
    }
  });
}

function checkExistingSession() {
  const savedCF = localStorage.getItem(FRONTEND_CONFIG.storage.CF);
  if (savedCF && isValidCF(savedCF)) {
    const cfInput = qsId('cf-input');
    if (cfInput) cfInput.value = savedCF;
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
  qsId('login-section').classList.add('hidden');
  qsId('user-dashboard').classList.remove('hidden');
  
  const userName = qsId('user-name');
  if (userName && clienteCorrente) {
    userName.textContent = clienteCorrente.Nome || 'Cliente';
  }
}

function handleLogout() {
  clienteCorrente = null;
  prenotazioniUtente = [];
  availableVehicles = [];
  clearBookingDraft();
  
  Object.values(FRONTEND_CONFIG.storage).forEach(key => {
    localStorage.removeItem(key);
  });
  
  qsId('login-section').classList.remove('hidden');
  qsId('user-dashboard').classList.add('hidden');
  qsId('cf-input').value = '';
  
  hideNewCustomerCTA();
  showToast('Disconnesso', 'info');
}

// =====================
// INITIAL DATA LOADING
// =====================
async function loadInitialData() {
  await Promise.all([
    loadUserBookings(),
    loadAvailableVehicles()
  ]);
  
  // Mostra CTA nuovo cliente se non ha prenotazioni
  checkAndShowNewCustomerCTA();
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
// NEW CUSTOMER CTA
// =====================
function checkAndShowNewCustomerCTA() {
  if (!prenotazioniUtente.length) {
    showNewCustomerCTA();
  } else {
    hideNewCustomerCTA();
  }
}

function showNewCustomerCTA() {
  let cta = qsId('new-customer-cta');
  if (!cta) {
    cta = document.createElement('div');
    cta.id = 'new-customer-cta';
    cta.className = 'new-customer-banner';
    cta.innerHTML = `
      <div class="banner-content">
        <div class="banner-icon">🎆</div>
        <div class="banner-text">
          <h4>Benvenuto in Imbriani Noleggio!</h4>
          <p>Sei un nuovo cliente? Scopri subito i nostri pulmini disponibili per le tue date.</p>
        </div>
        <button class="btn btn-primary banner-btn" id="cta-check-availability">
          🔍 Verifica Disponibilità
        </button>
      </div>
    `;
    
    // Inserisci prima delle tabs
    const tabsNav = document.querySelector('.tabs-nav');
    if (tabsNav) {
      tabsNav.parentNode.insertBefore(cta, tabsNav);
    }
    
    // Bind click event
    qsId('cta-check-availability').addEventListener('click', () => {
      hideNewCustomerCTA();
      switchTab('nuovo');
      goToStep(2); // Vai direttamente alla selezione veicoli
      
      // Pre-compila date se vuote
      const dataRitiro = qsId('data-ritiro');
      const oraRitiro = qsId('ora-ritiro');
      if (dataRitiro && !dataRitiro.value) {
        dataRitiro.value = getTomorrowDate();
      }
      if (oraRitiro && !oraRitiro.value) {
        oraRitiro.value = getNextValidTime();
      }
      
      showToast('Ecco i nostri pulmini disponibili!', 'info');
    });
  }
  
  cta.classList.remove('hidden');
}

function hideNewCustomerCTA() {
  const cta = qsId('new-customer-cta');
  if (cta) cta.classList.add('hidden');
}

// =====================
// TAB MANAGEMENT
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
// WIZARD MANAGEMENT
// =====================
function prepareWizard() {
  // Carica bozza salvata se disponibile
  const draft = loadBookingDraft();
  if (draft) {
    restoreDraftData(draft);
  } else {
    // Pre-compila con valori sensati
    preFillWizardDefaults();
  }
  
  // Assicurati che ci sia almeno un autista
  const container = qsId('autisti-container');
  if (container && !container.children.length) {
    addDriver(true); // Primo autista con auto-fill
  }
}

function preFillWizardDefaults() {
  const tomorrow = getTomorrowDate();
  const nextTime = getNextValidTime();
  
  const dataRitiro = qsId('data-ritiro');
  const oraRitiro = qsId('ora-ritiro');
  const dataConsegna = qsId('data-consegna');
  const oraConsegna = qsId('ora-consegna');
  
  if (dataRitiro && !dataRitiro.value) dataRitiro.value = tomorrow;
  if (oraRitiro && !oraRitiro.value) oraRitiro.value = nextTime;
  if (dataConsegna && !dataConsegna.value) {
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dataConsegna.value = dayAfter.toISOString().split('T')[0];
  }
  if (oraConsegna && !oraConsegna.value) oraConsegna.value = nextTime;
}

function goToStep(stepNum) {
  // Update progress indicators
  document.querySelectorAll('.progress-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 <= stepNum);
  });
  
  // Update step content
  document.querySelectorAll('.wizard-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === stepNum);
  });
  
  stepAttuale = stepNum;
  
  // Auto-focus primo campo del step
  setTimeout(() => {
    const activeStep = document.querySelector('.wizard-step.active');
    const firstInput = activeStep?.querySelector('input, select');
    if (firstInput) firstInput.focus();
  }, 100);
}

function validateAndGoToStep(stepNum) {
  if (stepNum === 2) {
    if (!validateStep1()) return;
    collectStep1Data();
    loadAvailableVehicles(); // Ricarica per eventuali filtri
  }
  
  if (stepNum === 3) {
    if (!bookingData.selectedVehicle) {
      showToast('Seleziona un veicolo per continuare', 'warning');
      return;
    }
  }
  
  if (stepNum === 4) {
    const drivers = collectDriverData();
    if (!drivers.length) {
      showToast('Aggiungi almeno un autista valido', 'warning');
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
      missing.push(fieldId.replace('-', ' '));
    }
  }
  
  if (missing.length) {
    showToast(`Compila: ${missing.join(', ')}`, 'warning');
    return false;
  }
  
  // Validazione logica date
  const dataRitiro = new Date(qsId('data-ritiro').value);
  const dataConsegna = new Date(qsId('data-consegna').value);
  const oggi = new Date();
  oggi.setHours(0,0,0,0);
  
  if (dataRitiro < oggi) {
    showToast('La data di ritiro non può essere nel passato', 'warning');
    return false;
  }
  
  if (dataConsegna < dataRitiro) {
    showToast('La data di consegna deve essere successiva al ritiro', 'warning');
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
  saveBookingDraft(bookingData);
}

// =====================
// VEHICLE MANAGEMENT
// =====================
function renderVehicles(vehicles) {
  const container = qsId('veicoli-list');
  if (!container) return;
  
  if (!vehicles.length) {
    container.innerHTML = '<div class="empty-message">Nessun pulmino disponibile per il periodo selezionato</div>';
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
  
  // Enable next button
  const nextBtn = qsId('step2-next');
  if (nextBtn) nextBtn.disabled = false;
  
  saveBookingDraft(bookingData);
  showToast(`Selezionato: ${targa}`, 'success');
}

// =====================
// DRIVER MANAGEMENT
// =====================
function addDriver(isFirst = false) {
  const container = qsId('autisti-container');
  if (!container) return;
  
  const currentCount = container.children.length;
  if (currentCount >= FRONTEND_CONFIG.validation.MAX_AUTISTI) {
    showToast(`Massimo ${FRONTEND_CONFIG.validation.MAX_AUTISTI} autisti`, 'warning');
    return;
  }
  
  // Auto-fill data from last booking if first driver
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
  
  updateDriverValidation();
}

function createDriverFormHTML(index, isFirst, prefillData) {
  return `
    <div class="driver-header">
      <h5>👤 Autista ${index}${isFirst ? ' (Intestatario)' : ''}</h5>
      ${!isFirst ? '<button type="button" class="btn btn-sm btn-outline remove-driver">❌ Rimuovi</button>' : ''}
    </div>
    <div class="driver-fields">
      <div class="form-row">
        <div class="form-group">
          <label>Nome:</label>
          <input type="text" class="driver-nome" value="${prefillData.Nome || ''}" required>
        </div>
        <div class="form-group">
          <label>Cognome:</label>
          <input type="text" class="driver-cognome" value="" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Codice Fiscale:</label>
          <input type="text" class="driver-cf" maxlength="16" value="${prefillData.CF || (isFirst ? clienteCorrente?.CF || '' : '')}" required>
        </div>
        <div class="form-group">
          <label>Data di nascita:</label>
          <input type="date" class="driver-data-nascita" value="${prefillData.DataNascita || ''}" required>
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
          <input type="text" class="driver-indirizzo" value="${prefillData.ViaResidenza || ''} ${prefillData.CivicoResidenza || ''}">
        </div>
        <div class="form-group">
          <label>Numero patente:</label>
          <input type="text" class="driver-patente" value="${prefillData.NumeroPatente || ''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Patente dal:</label>
          <input type="date" class="driver-inizio-patente" value="${prefillData.InizioPatente || ''}">
        </div>
        <div class="form-group">
          <label>Scadenza patente:</label>
          <input type="date" class="driver-scadenza" value="${prefillData.ScadenzaPatente || ''}" required>
        </div>
      </div>
    </div>
  `;
}

function removeDriver(btn) {
  const driverForm = btn.closest('.driver-form');
  if (driverForm) {
    driverForm.remove();
    updateDriverNumbers();
    updateDriverValidation();
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
  const nextBtn = qsId('step3-next');
  if (nextBtn) {
    nextBtn.disabled = driversCount < FRONTEND_CONFIG.validation.MIN_AUTISTI;
  }
}

function collectDriverData() {
  const drivers = [];
  document.querySelectorAll('.driver-form').forEach(form => {
    const driver = {
      Nome: form.querySelector('.driver-nome').value.trim(),
      Cognome: form.querySelector('.driver-cognome').value.trim(),
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
    
    // Validate required fields
    if (driver.Nome && driver.Cognome && isValidCF(driver.CF) && driver.NumeroPatente && driver.ScadenzaPatente) {
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
    const statusClass = booking.Stato.toLowerCase().replace(' ', '-');
    
    return `
      <div class="booking-item">
        <div class="booking-header">
          <span class="booking-id">#${booking.ID}</span>
          <span class="booking-status ${statusClass}">${statusEmoji} ${booking.Stato}</span>
        </div>
        <div class="booking-info">
          <div class="booking-dates">
            📅 ${formattaDataIT(booking.DataRitiro)} ${booking.OraRitiro} → ${formattaDataIT(booking.DataConsegna)} ${booking.OraConsegna}
          </div>
          <div class="booking-destination">🎯 ${booking.Destinazione}</div>
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
          <span class="summary-label">Veicolo:</span>
          <span class="summary-value">${targa}</span>
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
          <strong>Autista ${i + 1}:</strong> ${d.Nome} ${d.Cognome} (${d.CF})
        </div>
      `).join('')}
    </div>
  `;
}

async function submitBooking() {
  if (!bookingData.drivers?.length) {
    showToast('Errore: nessun autista valido', 'danger');
    return;
  }
  
  showLoader(true);
  
  const payload = {
    cf: clienteCorrente.CF,
    ...bookingData,
    drivers: encodeURIComponent(JSON.stringify(bookingData.drivers))
  };
  delete payload.selectedVehicle; // Non serve nel backend
  
  try {
    const response = await callAPI('creaPrenotazione', payload);
    
    if (response.success) {
      showToast('✅ Prenotazione inviata con successo!', 'success');
      clearBookingDraft();
      resetWizard();
      switchTab('prenotazioni');
      await loadUserBookings();
      hideNewCustomerCTA(); // Ora non è più nuovo cliente
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
// PROFILE MANAGEMENT
// =====================
function loadUserProfile() {
  if (!clienteCorrente) return;
  
  const fields = {
    'profile-nome': clienteCorrente.Nome || '',
    'profile-email': clienteCorrente.Email || '',
    'profile-telefono': clienteCorrente.Cellulare || ''
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const element = qsId(id);
    if (element) element.value = value;
  });
}

// =====================
// DRAFT MANAGEMENT
// =====================
function saveDraftData() {
  if (stepAttuale === 1) {
    collectStep1Data();
  }
}

function restoreDraftData(draft) {
  if (!draft) return;
  
  const fields = ['data-ritiro', 'ora-ritiro', 'data-consegna', 'ora-consegna', 'destinazione'];
  fields.forEach(id => {
    const field = qsId(id);
    const draftKey = id.replace('-', '_').replace('_', '');
    if (field && draft[draftKey]) {
      field.value = draft[draftKey];
    }
  });
  
  bookingData = { ...draft };
}

function resetWizard() {
  stepAttuale = 1;
  bookingData = {};
  goToStep(1);
  
  // Clear drivers container
  const container = qsId('autisti-container');
  if (container) container.innerHTML = '';
  
  // Add first driver with auto-fill
  setTimeout(() => addDriver(true), 100);
  
  clearBookingDraft();
}

console.log('%c🔧 Scripts v5.5.0 loaded successfully', 'color: #28a745; font-weight: bold;');
