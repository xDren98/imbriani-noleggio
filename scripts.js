/* ═══════════════════════════════════════════════════════════════════════════════
   IMBRIANI STEFANO NOLEGGIO - scripts.js v6.1.0 PATCHED
   + Fix profilo completo + Date ISO format + Enhanced UX + New branding
   ═══════════════════════════════════════════════════════════════════════════════ */

'use strict';

const VERSION = '6.1.0';
let clienteCorrente = null;
let prenotazioniUtente = [];
let availableVehicles = [];
let stepAttuale = 1;
let bookingData = {};
let draftTimer = null;

console.log(`%c🎉 Imbriani Stefano Noleggio v${VERSION}`, 'font-size: 14px; font-weight: bold; color: #007f17;');

// =====================
// DATE UTILITIES (fix warnings yyyy-MM-dd)
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

function composeAddress(via, civico, comune) {
  const parts = [via, civico, comune].filter(p => p && String(p).trim());
  return parts.join(' ');
}

// =====================
// INIT & DOM READY
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  checkExistingSession();
  setupAutoSaveDraft();
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

  // New customer CTA
  const checkAvailabilityCTA = qsId('check-availability-cta');
  if (checkAvailabilityCTA) {
    checkAvailabilityCTA.addEventListener('click', handleNewCustomerCTA);
  }

  // Refresh actions
  const refreshBtn = qsId('refresh-bookings');
  if (refreshBtn) refreshBtn.addEventListener('click', loadUserBookings);

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
  
  // Reset sections visibility
  showHomepageSection('login');
  
  showToast('Disconnesso', 'info');
}

// =====================
// HOMEPAGE SECTIONS (NEW/EXISTING)
// =====================
function showHomepageSection(type) {
  const newSection = qsId('new-customer-section');
  const existingSection = qsId('existing-customer-section');
  
  if (type === 'new') {
    // 🎆 NUOVO CLIENTE
    if (newSection) newSection.classList.remove('hidden');
    if (existingSection) existingSection.classList.add('hidden');
  } else {
    // 📋 CLIENTE ESISTENTE
    if (newSection) newSection.classList.add('hidden');
    if (existingSection) existingSection.classList.remove('hidden');
  }
}

function handleNewCustomerCTA() {
  // Switch to existing customer section and open wizard
  showHomepageSection('existing');
  switchTab('nuovo');
  
  // Pre-fill dates and go directly to Step 2 (vehicle selection)
  preFillWizardDefaults();
  setTimeout(() => {
    goToStep(2);
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
  
  // Decide homepage layout based on booking history
  decideDashboardLayout();
}

function decideDashboardLayout() {
  const hasBookings = prenotazioniUtente.length > 0;
  const isNewCustomer = !clienteCorrente?.ultimoAutista;
  
  if (hasBookings || !isNewCustomer) {
    // Cliente esistente con prenotazioni
    showHomepageSection('existing');
  } else {
    // Nuovo cliente - mostra CTA
    showHomepageSection('new');
  }
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
// WIZARD MANAGEMENT
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
  // Update progress indicators
  document.querySelectorAll('.progress-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 <= stepNum);
    step.classList.toggle('completed', idx + 1 < stepNum);
  });
  
  // Update step content
  document.querySelectorAll('.wizard-step').forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === stepNum);
  });
  
  stepAttuale = stepNum;
  
  // Auto-focus primo campo del step
  setTimeout(() => {
    const activeStep = document.querySelector('.wizard-step.active');
    const firstInput = activeStep?.querySelector('input:not([readonly]), select');
    if (firstInput && !firstInput.value) firstInput.focus();
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
    const drivers = collectDriverData();
    if (!drivers.length) {
      showToast('Aggiungi almeno un autista valido', 'warning');
      return;
    }
    if (drivers.some(d => !isValidCF(d.CF))) {
      showToast('Controlla i codici fiscali degli autisti', 'warning');
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
  
  // Enable next button
  const nextBtn = qsId('step2-next');
  if (nextBtn) nextBtn.disabled = false;
  
  saveBookingDraft(bookingData);
  showToast(`✅ Selezionato: ${targa}`, 'success');
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
  
  // 🎯 Auto-fill data from last booking if first driver
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
  // Smart name splitting if available
  let prefillNome = prefillData.Nome || '';
  let prefillCognome = '';
  
  if (prefillNome && prefillNome.includes(' ')) {
    const nameParts = prefillNome.split(' ');
    prefillNome = nameParts[0];
    prefillCognome = nameParts.slice(1).join(' ');
  }
  
  return `
    <div class="driver-header">
      <h5>👤 Autista ${index}${isFirst ? ' (Intestatario)' : ''}</h5>
      ${!isFirst ? '<button type="button" class="btn btn-sm btn-outline remove-driver">❌ Rimuovi</button>' : ''}
    </div>
    <div class="driver-fields">
      <div class="form-row">
        <div class="form-group">
          <label>Nome:</label>
          <input type="text" class="driver-nome" value="${prefillNome}" required>
        </div>
        <div class="form-group">
          <label>Cognome:</label>
          <input type="text" class="driver-cognome" value="${prefillCognome}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Codice Fiscale:</label>
          <input type="text" class="driver-cf" maxlength="16" value="${prefillData.CF || (isFirst ? clienteCorrente?.CF || '' : '')}" required>
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
    });
  }
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
          <strong>Autista ${i + 1}:</strong> ${d.Nome} ${d.Cognome} (${d.CF})
          <br><small>📝 Patente: ${d.NumeroPatente} - Scad: ${formattaDataIT(d.ScadenzaPatente)}</small>
        </div>
      `).join('')}
    </div>
    <div class="booking-note">
      <p><strong>🎯 Nota:</strong> Dopo l'invio riceverai un ID prenotazione univoco formato <code>BOOK-2025-XXX</code></p>
      <p><small>La prenotazione sarà in stato "Da Confermare" fino all'approvazione dell'admin.</small></p>
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
      const bookingID = response.data?.id || 'N/A';
      showToast(`✅ Prenotazione ${bookingID} inviata con successo!`, 'success', 5000);
      clearBookingDraft();
      resetWizard();
      
      // Switch to bookings and refresh
      showHomepageSection('existing');
      switchTab('prenotazioni');
      await loadUserBookings();
      
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
// PROFILE MANAGEMENT (ENHANCED)
// =====================
function loadUserProfile() {
  if (!clienteCorrente) return;

  // 🎯 Smart nome/cognome splitting se "Nome" contiene tutto
  const fullName = (clienteCorrente.Nome || '').trim();
  let nome = fullName, cognome = '';
  
  if (fullName.includes(' ')) {
    const nameParts = fullName.split(/\s+/);
    nome = nameParts[0];
    cognome = nameParts.slice(1).join(' ');
  }

  // 🎯 Composizione indirizzo completo da ultimoAutista
  const ultimoAutista = clienteCorrente.ultimoAutista || {};
  const indirizzoCompleto = composeAddress(
    ultimoAutista.ViaResidenza,
    ultimoAutista.CivicoResidenza,
    ultimoAutista.ComuneResidenza
  );

  const fields = {
    'profile-nome': nome,
    'profile-cognome': cognome,
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
// DRAFT MANAGEMENT
// =====================
function saveDraftData() {
  if (stepAttuale === 1) {
    collectStep1Data();
  }
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
  goToStep(1);
  
  // Clear drivers container
  const container = qsId('autisti-container');
  if (container) container.innerHTML = '';
  
  // Pre-fill defaults and add first driver
  preFillWizardDefaults();
  setTimeout(() => addDriver(true), 100);
  
  clearBookingDraft();
}

console.log('%c🔧 Scripts v6.1.0 PATCHED loaded successfully', 'color: #28a745; font-weight: bold;');