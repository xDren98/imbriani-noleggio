/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - admin.js v2.0 (adapted for static hosting)
   Dashboard Admin: Prenotazioni, Conferma, Modifica, Export
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

let allBookings = [];
let filteredBookings = [];

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
});

function initAdmin() {
  // Admin login form
  const loginForm = document.getElementById('admin-password-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleAdminLogin);
  }

  // Admin actions
  const refreshBtn = document.getElementById('refresh-data');
  const exportBtn = document.getElementById('export-csv');
  const logoutBtn = document.getElementById('admin-logout');
  const filterSelect = document.getElementById('filter-stato');

  if (refreshBtn) refreshBtn.addEventListener('click', loadAllBookings);
  if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
  if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);
  if (filterSelect) filterSelect.addEventListener('change', filterBookings);

  console.log('%c🔐 Admin Dashboard Ready', 'color: #667eea; font-weight: bold;');
}

// =====================
// AUTHENTICATION
// =====================
function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById('admin-pw').value;
  
  // Simple password check (you can enhance this)
  if (password === 'noleggio2025') {
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
    showToast('Accesso effettuato!', 'success');
    loadAllBookings();
  } else {
    showToast('Password non corretta', 'danger');
  }
}

function adminLogout() {
  document.getElementById('admin-dashboard').classList.add('hidden');
  document.getElementById('admin-login').classList.remove('hidden');
  document.getElementById('admin-pw').value = '';
  showToast('Disconnesso', 'info');
}

// =====================
// DATA LOADING
// =====================
async function loadAllBookings() {
  showLoader(true);
  try {
    // Get all bookings
    const response = await callAPI('recuperaPrenotazioni', { cf: 'ALL' });
    
    if (response.success) {
      allBookings = response.data || [];
      filteredBookings = [...allBookings];
      renderBookings();
      updateStats();
      showToast('Dati aggiornati', 'success');
    } else {
      showToast(response.message || 'Errore caricamento', 'danger');
    }
  } catch (error) {
    showToast('Errore di rete', 'danger');
    console.error('Load bookings error:', error);
  } finally {
    showLoader(false);
  }
}

// =====================
// RENDERING
// =====================
function renderBookings() {
  const pendingList = document.getElementById('pending-list');
  const allList = document.getElementById('all-bookings-list');
  
  if (!pendingList || !allList) return;

  // Pending bookings
  const pending = filteredBookings.filter(b => b.Stato === 'Da Confermare');
  pendingList.innerHTML = pending.length ? '' : '<p class="empty-message">Nessuna prenotazione da confermare</p>';
  
  pending.forEach(booking => {
    pendingList.appendChild(createBookingCard(booking, true));
  });

  // All bookings
  allList.innerHTML = filteredBookings.length ? '' : '<p class="empty-message">Nessuna prenotazione trovata</p>';
  
  filteredBookings.forEach(booking => {
    allList.appendChild(createBookingCard(booking, false));
  });
}

function createBookingCard(booking, showActions = false) {
  const card = document.createElement('div');
  card.className = 'booking-admin-card';
  
  const statusEmoji = getStatusEmoji(booking.Stato);
  
  card.innerHTML = `
    <div class="booking-header">
      <div class="booking-id">#${booking.ID}</div>
      <div class="booking-status ${booking.Stato.toLowerCase()}">${statusEmoji} ${booking.Stato}</div>
    </div>
    <div class="booking-details">
      <div class="detail-row">
        <strong>👤 Cliente:</strong> ${booking.Nome} (${booking.CF})
      </div>
      <div class="detail-row">
        <strong>📅 Periodo:</strong> ${booking.DataRitiro} ${booking.OraRitiro} → ${booking.DataConsegna} ${booking.OraConsegna}
      </div>
      <div class="detail-row">
        <strong>🎯 Destinazione:</strong> ${booking.Destinazione}
      </div>
      <div class="detail-row">
        <strong>🚗 Veicolo:</strong> ${booking.Targa || 'TBD'}
      </div>
      <div class="detail-row">
        <strong>📞 Contatto:</strong> ${booking.Cellulare}
      </div>
    </div>
    ${showActions ? createActionButtons(booking) : ''}
  `;
  
  return card;
}

function createActionButtons(booking) {
  return `
    <div class="booking-actions">
      <button 
        class="btn btn-success btn-sm" 
        onclick="updateBookingStatus(${booking.ID}, 'Confermata')"
      >
        ✅ Conferma
      </button>
      <button 
        class="btn btn-danger btn-sm" 
        onclick="updateBookingStatus(${booking.ID}, 'Rifiutata')"
      >
        ❌ Rifiuta
      </button>
    </div>
  `;
}

function getStatusEmoji(stato) {
  const emoji = {
    'Da Confermare': '⏳',
    'Confermata': '✅',
    'Rifiutata': '❌',
    'Annullata': '🚫'
  };
  return emoji[stato] || '❓';
}

// =====================
// ACTIONS
// =====================
async function updateBookingStatus(bookingId, newStatus) {
  showLoader(true);
  try {
    const response = await callAPI('modificaStato', { id: bookingId, stato: newStatus });
    
    if (response.success) {
      showToast(`Prenotazione #${bookingId} ${newStatus.toLowerCase()}`, 'success');
      await loadAllBookings(); // Reload to refresh the view
    } else {
      showToast(response.message || 'Errore aggiornamento', 'danger');
    }
  } catch (error) {
    showToast('Errore di rete', 'danger');
    console.error('Update status error:', error);
  } finally {
    showLoader(false);
  }
}

function filterBookings() {
  const selectedStatus = document.getElementById('filter-stato').value;
  
  if (selectedStatus) {
    filteredBookings = allBookings.filter(b => b.Stato === selectedStatus);
  } else {
    filteredBookings = [...allBookings];
  }
  
  renderBookings();
}

function updateStats() {
  const total = allBookings.length;
  const pending = allBookings.filter(b => b.Stato === 'Da Confermare').length;
  const confirmed = allBookings.filter(b => b.Stato === 'Confermata').length;
  
  const totalEl = document.getElementById('total-bookings');
  const pendingEl = document.getElementById('pending-bookings');
  const confirmedEl = document.getElementById('confirmed-bookings');
  
  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (confirmedEl) confirmedEl.textContent = confirmed;
}

// =====================
// EXPORT
// =====================
function exportToCSV() {
  if (!filteredBookings.length) {
    showToast('Nessun dato da esportare', 'warning');
    return;
  }

  const headers = ['ID', 'Nome', 'CF', 'Data Ritiro', 'Ora Ritiro', 'Data Consegna', 'Ora Consegna', 'Targa', 'Destinazione', 'Stato', 'Cellulare', 'Email'];
  const csvContent = [
    headers.join(','),
    ...filteredBookings.map(b => [
      b.ID || '',
      b.Nome || '',
      b.CF || '',
      b.DataRitiro || '',
      b.OraRitiro || '',
      b.DataConsegna || '',
      b.OraConsegna || '',
      b.Targa || '',
      b.Destinazione || '',
      b.Stato || '',
      b.Cellulare || '',
      b.Email || ''
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prenotazioni-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  showToast('Export completato!', 'success');
}

console.log('%c⚡ Admin Panel Ready', 'color: #667eea; font-weight: bold;');
