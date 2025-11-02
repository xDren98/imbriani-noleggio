// Frontend scripts aligned with backend API actions
'use strict';

let clienteCorrente = null;
let prenotazioniUtente = [];
let availableVehicles = [];
let stepAttuale = 1;
let bookingData = {};
let preventivoRequested = false;

document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM loaded');
  
  // Login handler
  const loginForm = qsId('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    console.log('✅ Login handler attached');
  }
  
  // Tab handlers
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });
  
  // New customer CTA
  const newCustomerCTA = qsId('new-customer-cta');
  if (newCustomerCTA) {
    newCustomerCTA.addEventListener('click', handleNewCustomerCTA);
  }
  
  // Logout
  const logoutBtn = qsId('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  // Refresh bookings
  const refreshBtn = qsId('refresh-bookings');
  if (refreshBtn) refreshBtn.addEventListener('click', loadUserBookings);
  
  // Wizard navigation
  setupWizardNavigation();
  
  // Preventivo buttons
  const callBtn = qsId('call-btn');
  const whatsappBtn = qsId('whatsapp-btn');
  if (callBtn) callBtn.addEventListener('click', handleCallPreventivo);
  if (whatsappBtn) whatsappBtn.addEventListener('click', handleWhatsAppPreventivo);
});

async function handleLogin(e) {
  e.preventDefault();
  console.log('🚀 Login clicked');
  
  const cfInput = qsId('cf-input');
  const cf = cfInput.value.toUpperCase().trim();
  
  if (!isValidCF(cf)) {
    showToast('CF non valido (16 caratteri)', 'error');
    return;
  }
  
  showLoader(true);
  
  try {
    const response = await callAPI('login', { cf });
    console.log('📡 API response:', response);
    
    if (response.success) {
      clienteCorrente = response.data;
      localStorage.setItem(FRONTEND_CONFIG.storage.CF, cf);
      
      showToast('✅ Login riuscito!', 'success');
      
      // Hide homepage, show dashboard
      const homepage = qsId('homepage-sections');
      const dashboard = qsId('user-dashboard');
      if (homepage) homepage.classList.add('hidden');
      if (dashboard) dashboard.classList.remove('hidden');
      
      // Update user name
      const userName = qsId('user-name');
      if (userName) userName.textContent = clienteCorrente.Nome || 'Cliente';
      
      // Load user bookings
      await loadUserBookings();
      
    } else {
      showToast(response.message || 'Errore login', 'error');
    }
  } catch (error) {
    showToast('Errore connessione', 'error');
  } finally {
    showLoader(false);
  }
}

function handleLogout() {
  clienteCorrente = null;
  prenotazioniUtente = [];
  localStorage.removeItem(FRONTEND_CONFIG.storage.CF);
  
  const homepage = qsId('homepage-sections');
  const dashboard = qsId('user-dashboard');
  if (homepage) homepage.classList.remove('hidden');
  if (dashboard) dashboard.classList.add('hidden');
  
  const cfInput = qsId('cf-input');
  if (cfInput) cfInput.value = '';
  
  showToast('🚪 Disconnesso', 'info');
}

function handleNewCustomerCTA() {
  // Pre-fill tomorrow dates
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];
  
  // Show dashboard without login
  const homepage = qsId('homepage-sections');
  const dashboard = qsId('user-dashboard');
  if (homepage) homepage.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  
  // Switch to new booking tab
  switchTab('nuovo');
  
  // Pre-fill dates
  setTimeout(() => {
    const dataRitiro = qsId('data-ritiro');
    const dataConsegna = qsId('data-consegna');
    const oraRitiro = qsId('ora-ritiro');
    const oraConsegna = qsId('ora-consegna');
    
    if (dataRitiro) dataRitiro.value = tomorrowStr;
    if (dataConsegna) dataConsegna.value = dayAfterStr;
    if (oraRitiro) oraRitiro.value = '08:00';
    if (oraConsegna) oraConsegna.value = '20:00';
  }, 100);
  
  showToast('🚀 Date preimpostate per domani!', 'info');
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  
  // Update tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
  
  // Load data based on tab
  if (tabName === 'prenotazioni') {
    loadUserBookings();
  } else if (tabName === 'nuovo') {
    loadAvailableVehicles();
    goToStep(1);
  }
}

async function loadUserBookings() {
  const bookingsList = qsId('prenotazioni-list');
  const emptyState = qsId('empty-bookings');
  
  if (!bookingsList) return;
  
  if (!clienteCorrente?.CF) {
    if (emptyState) emptyState.classList.remove('hidden');
    bookingsList.innerHTML = '';
    return;
  }
  
  try {
    const response = await callAPI('recuperaPrenotazioni', { cf: clienteCorrente.CF });
    
    if (response.success) {
      prenotazioniUtente = response.data || [];
      
      if (prenotazioniUtente.length === 0) {
        bookingsList.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        if (emptyState) emptyState.classList.add('hidden');
        renderUserBookings();
      }
    } else {
      showToast('❌ Errore caricamento prenotazioni', 'error');
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
    showToast('❌ Errore connessione prenotazioni', 'error');
  }
}

function renderUserBookings() {
  const bookingsList = qsId('prenotazioni-list');
  if (!bookingsList) return;
  
  bookingsList.innerHTML = prenotazioniUtente.map(booking => `
    <div class="booking-card">
      <div class="booking-header">
        <h5>📋 #${booking.ID}</h5>
        <span class="badge ${getStatusClass(booking.Stato)}">${getStatusEmoji(booking.Stato)} ${booking.Stato}</span>
      </div>
      <div class="booking-details">
        <p><strong>📅 Periodo:</strong> ${formattaDataIT(booking.DataRitiro)} ${booking.OraRitiro} → ${formattaDataIT(booking.DataConsegna)} ${booking.OraConsegna}</p>
        <p><strong>🎯 Destinazione:</strong> ${booking.Destinazione}</p>
        <p><strong>🚐 Pulmino:</strong> ${booking.Targa || 'Da assegnare'}</p>
        <p><strong>📅 Creata:</strong> ${formattaDataIT(booking.DataCreazione)}</p>
      </div>
    </div>
  `).join('');
}

async function loadAvailableVehicles() {
  const vehiclesList = qsId('veicoli-list');
  if (!vehiclesList) return;
  
  try {
    const response = await callAPI('disponibilita');
    
    if (response.success) {
      availableVehicles = response.data || [];
      renderVehicles();
    } else {
      showToast('❌ Errore caricamento veicoli', 'error');
    }
  } catch (error) {
    console.error('Error loading vehicles:', error);
    showToast('❌ Errore connessione veicoli', 'error');
  }
}

function renderVehicles() {
  const vehiclesList = qsId('veicoli-list');
  if (!vehiclesList) return;
  
  if (!availableVehicles.length) {
    vehiclesList.innerHTML = '<p>📭 Nessun pulmino disponibile</p>';
    return;
  }
  
  vehiclesList.innerHTML = availableVehicles.map(vehicle => `
    <div class="vehicle-card" onclick="selectVehicle('${vehicle.Targa}', this)">
      <div class="vehicle-header">
        <strong>🚐 ${vehicle.Targa}</strong>
        <span class="badge badge-success">👥 ${vehicle.Posti} posti</span>
      </div>
      <div class="vehicle-details">
        <div class="vehicle-model">${vehicle.Marca} ${vehicle.Modello}</div>
        <div class="vehicle-status">✅ Disponibile</div>
      </div>
    </div>
  `).join('');
}

function selectVehicle(targa, element) {
  document.querySelectorAll('.vehicle-card').forEach(card => {
    card.classList.remove('active');
  });
  
  element.classList.add('active');
  
  bookingData.selectedVehicle = availableVehicles.find(v => v.Targa === targa);
  bookingData.targa = targa;
  
  const nextBtn = qsId('step2-next');
  if (nextBtn) nextBtn.disabled = false;
  
  showToast('✅ Pulmino selezionato: ' + targa, 'success');
}

function setupWizardNavigation() {
  const nav = {
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

  Object.entries(nav).forEach(([id, handler]) => {
    const btn = qsId(id);
    if (btn) btn.addEventListener('click', handler);
  });
}

function goToStep(step) {
  stepAttuale = step;
  
  for (let i = 1; i <= 5; i++) {
    const stepEl = qsId(`step-${i}`);
    if (stepEl) stepEl.classList.toggle('active', i === step);
  }
  
  document.querySelectorAll('.progress-step').forEach((el, idx) => {
    el.classList.toggle('active', idx + 1 === step);
    el.classList.toggle('completed', idx + 1 < step);
  });
  
  if (step === 2) loadAvailableVehicles();
  if (step === 3) updatePreventivoSummary();
}

function validateAndGoToStep(targetStep) {
  if (stepAttuale === 1) {
    const dataRitiro = qsId('data-ritiro')?.value;
    const oraRitiro = qsId('ora-ritiro')?.value;
    const dataConsegna = qsId('data-consegna')?.value;
    const oraConsegna = qsId('ora-consegna')?.value;
    const destinazione = qsId('destinazione')?.value?.trim();
    
    if (!dataRitiro || !oraRitiro || !dataConsegna || !oraConsegna || !destinazione) {
      showToast('⚠️ Compila tutti i campi', 'warning');
      return;
    }
    
    bookingData = {
      dataRitiro, oraRitiro, dataConsegna, oraConsegna, destinazione
    };
  }
  
  if (stepAttuale === 2 && !bookingData.targa) {
    showToast('⚠️ Seleziona un pulmino', 'warning');
    return;
  }
  
  if (stepAttuale === 3 && !preventivoRequested) {
    showToast('⚠️ Richiedi il preventivo prima di continuare', 'warning');
    return;
  }
  
  goToStep(targetStep);
}

function updatePreventivoSummary() {
  const container = qsId('preventivo-details');
  if (!container || !bookingData.targa) return;
  
  container.innerHTML = `
    <div class="summary-row"><span>🚐 Pulmino:</span> <strong>${bookingData.targa}</strong></div>
    <div class="summary-row"><span>📅 Ritiro:</span> <strong>${formattaDataIT(bookingData.dataRitiro)} alle ${bookingData.oraRitiro}</strong></div>
    <div class="summary-row"><span>📅 Consegna:</span> <strong>${formattaDataIT(bookingData.dataConsegna)} alle ${bookingData.oraConsegna}</strong></div>
    <div class="summary-row"><span>🎯 Destinazione:</span> <strong>${bookingData.destinazione}</strong></div>
  `;
}

function handleCallPreventivo() {
  window.open('tel:3286589618');
  markPreventivoRequested();
}

function handleWhatsAppPreventivo() {
  const message = `PREVENTIVO PULMINO IMBRIANI\n${bookingData.targa}\nDal: ${formattaDataIT(bookingData.dataRitiro)} ${bookingData.oraRitiro}\nAl: ${formattaDataIT(bookingData.dataConsegna)} ${bookingData.oraConsegna}\nDestinazione: ${bookingData.destinazione}`;
  const url = `https://wa.me/393286589618?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  markPreventivoRequested();
}

function markPreventivoRequested() {
  preventivoRequested = true;
  const statusDiv = qsId('preventivo-completed');
  if (statusDiv) statusDiv.classList.remove('hidden');
  
  const nextBtn = qsId('step3-next');
  if (nextBtn) nextBtn.disabled = false;
  
  showToast('✅ Preventivo richiesto! Ora puoi continuare', 'success');
}

function addDriver() {
  if (!bookingData.drivers) bookingData.drivers = [];
  
  if (bookingData.drivers.length >= 3) {
    showToast('⚠️ Massimo 3 autisti', 'warning');
    return;
  }
  
  const newDriver = {
    Nome: clienteCorrente?.Nome || '',
    CF: clienteCorrente?.CF || '',
    Email: clienteCorrente?.Email || '',
    Cellulare: clienteCorrente?.Cellulare || ''
  };
  
  bookingData.drivers.push(newDriver);
  renderDrivers();
}

function renderDrivers() {
  const container = qsId('autisti-container');
  if (!container || !bookingData.drivers) return;
  
  container.innerHTML = bookingData.drivers.map((driver, index) => `
    <div class="driver-row">
      <div class="driver-header">
        <h6>👤 Autista ${index + 1}</h6>
        ${index > 0 ? `<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeDriver(${index})">❌ Rimuovi</button>` : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nome:</label>
          <input type="text" class="form-control driver-nome" value="${driver.Nome}" data-index="${index}">
        </div>
        <div class="form-group">
          <label>CF:</label>
          <input type="text" class="form-control driver-cf" value="${driver.CF}" data-index="${index}" maxlength="16">
        </div>
      </div>
    </div>
  `).join('');
  
  // Enable next button if drivers exist
  const nextBtn = qsId('step4-next');
  if (nextBtn) nextBtn.disabled = bookingData.drivers.length === 0;
}

async function submitBooking() {
  if (!bookingData.targa || !clienteCorrente?.CF) {
    showToast('❌ Dati mancanti per prenotazione', 'error');
    return;
  }
  
  showLoader(true);
  
  try {
    const payload = {
      cf: clienteCorrente.CF,
      dataRitiro: bookingData.dataRitiro,
      oraRitiro: bookingData.oraRitiro,
      dataConsegna: bookingData.dataConsegna,
      oraConsegna: bookingData.oraConsegna,
      destinazione: bookingData.destinazione,
      targa: bookingData.targa,
      drivers: encodeURIComponent(JSON.stringify(bookingData.drivers || [{
        Nome: clienteCorrente.Nome || '',
        CF: clienteCorrente.CF,
        Email: clienteCorrente.Email || '',
        Cellulare: clienteCorrente.Cellulare || ''
      }]))
    };
    
    const response = await callAPI('creaPrenotazione', payload);
    
    if (response.success) {
      showToast('🎉 Prenotazione creata con ID: ' + response.data.id, 'success');
      switchTab('prenotazioni');
      loadUserBookings();
      bookingData = {};
      preventivoRequested = false;
    } else {
      showToast('❌ ' + response.message, 'error');
    }
  } catch (error) {
    showToast('❌ Errore creazione prenotazione', 'error');
  } finally {
    showLoader(false);
  }
}

function getStatusClass(status) {
  if (status === 'Confermata') return 'badge-success';
  if (status === 'Da confermare') return 'badge-warning';
  if (status === 'Annullata') return 'badge-danger';
  return 'badge-secondary';
}

function getStatusEmoji(status) {
  return FRONTEND_CONFIG.statiEmoji[status] || '❓';
}

// Make functions global
window.selectVehicle = selectVehicle;
window.removeDriver = function(index) {
  if (bookingData.drivers) {
    bookingData.drivers.splice(index, 1);
    renderDrivers();
  }
};

console.log('✅ scripts.js loaded - Backend aligned');