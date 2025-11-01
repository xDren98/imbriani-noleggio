/* ================================================================================
   ADMIN DASHBOARD PRO - JAVASCRIPT v7.5.0
   Complete admin functionality with filters, export, bulk actions & analytics
   ================================================================================ */

'use strict';

const ADMIN_VERSION = '7.5.0';
let allBookings = [];
let filteredBookings = [];
let selectedBookings = new Set();
let vehiclesChart = null;
let statusChart = null;

console.log(`%c🔧 Admin Dashboard Pro v${ADMIN_VERSION}`, 'font-size: 16px; font-weight: bold; color: #667eea;');

// =====================
// INITIALIZATION
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeDashboard();
  loadAllData();
  setupEventListeners();
  startClock();
});

function initializeDashboard() {
  console.log('🚀 Initializing Admin Dashboard Pro...');
  
  // Set default date filters (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  document.getElementById('filter-date-from').value = thirtyDaysAgo.toISOString().slice(0, 10);
  document.getElementById('filter-date-to').value = today.toISOString().slice(0, 10);
  
  showToast('Dashboard inizializzata', 'success');
}

function setupEventListeners() {
  // Filter actions
  document.getElementById('apply-filters').addEventListener('click', applyFilters);
  document.getElementById('clear-filters').addEventListener('click', clearFilters);
  
  // Bulk actions
  document.getElementById('select-all').addEventListener('change', toggleSelectAll);
  document.getElementById('bulk-confirm').addEventListener('click', () => bulkUpdateStatus('Confermata'));
  document.getElementById('bulk-reject').addEventListener('click', () => bulkUpdateStatus('Annullata'));
  
  // Export actions
  document.getElementById('export-excel').addEventListener('click', exportToExcel);
  document.getElementById('export-filtered').addEventListener('click', () => exportToExcel(true));
  
  // Refresh
  document.getElementById('refresh-all').addEventListener('click', loadAllData);
  
  // Live search client filter
  document.getElementById('filter-client').addEventListener('input', debounce(applyFilters, 300));
}

function startClock() {
  function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    document.getElementById('current-time').textContent = timeString;
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

// =====================
// DATA LOADING
// =====================
async function loadAllData() {
  showToast('Caricamento dati...', 'info');
  
  try {
    // Load bookings
    const bookingsResponse = await callAPI('getAllBookings');
    if (bookingsResponse.success) {
      allBookings = bookingsResponse.data || [];
      console.log(`📋 Caricate ${allBookings.length} prenotazioni`);
    }
    
    // Load vehicles for filter dropdown
    const vehiclesResponse = await callAPI('getAllVehicles');
    if (vehiclesResponse.success) {
      populateVehicleFilter(vehiclesResponse.data || []);
    }
    
    // Apply initial filters and render
    applyFilters();
    updateStatistics();
    updateCharts();
    
    showToast(`✅ Caricati ${allBookings.length} record`, 'success');
    
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Errore caricamento dati', 'error');
  }
}

function populateVehicleFilter(vehicles) {
  const select = document.getElementById('filter-vehicle');
  
  // Clear existing options (keep "Tutti i pulmini")
  select.innerHTML = '<option value="">Tutti i pulmini</option>';
  
  // Add vehicle options
  vehicles.forEach(vehicle => {
    const option = document.createElement('option');
    option.value = vehicle.Targa;
    option.textContent = `${vehicle.Targa} - ${vehicle.Marca} ${vehicle.Modello}`;
    select.appendChild(option);
  });
}

// =====================
// FILTERING
// =====================
function applyFilters() {
  const filters = {
    dateFrom: document.getElementById('filter-date-from').value,
    dateTo: document.getElementById('filter-date-to').value,
    status: document.getElementById('filter-status').value,
    vehicle: document.getElementById('filter-vehicle').value,
    client: document.getElementById('filter-client').value.toLowerCase().trim()
  };
  
  filteredBookings = allBookings.filter(booking => {
    // Date filter
    if (filters.dateFrom) {
      const bookingDate = new Date(booking.DataCreazione || booking.DataRitiro);
      const fromDate = new Date(filters.dateFrom);
      if (bookingDate < fromDate) return false;
    }
    
    if (filters.dateTo) {
      const bookingDate = new Date(booking.DataCreazione || booking.DataRitiro);
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      if (bookingDate > toDate) return false;
    }
    
    // Status filter
    if (filters.status && booking.Stato !== filters.status) {
      return false;
    }
    
    // Vehicle filter
    if (filters.vehicle && booking.Targa !== filters.vehicle) {
      return false;
    }
    
    // Client filter
    if (filters.client) {
      const clientName = (booking.NomeCompleto || booking.Cliente || '').toLowerCase();
      if (!clientName.includes(filters.client)) {
        return false;
      }
    }
    
    return true;
  });
  
  renderBookingsTable();
  updateFilteredCount();
  console.log(`🔍 Filtrate ${filteredBookings.length}/${allBookings.length} prenotazioni`);
}

function clearFilters() {
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-vehicle').value = '';
  document.getElementById('filter-client').value = '';
  
  applyFilters();
  showToast('Filtri rimossi', 'info');
}

function updateFilteredCount() {
  const total = allBookings.length;
  const filtered = filteredBookings.length;
  
  if (filtered !== total) {
    showToast(`Mostrate ${filtered} di ${total} prenotazioni`, 'info');
  }
}

// =====================
// TABLE RENDERING
// =====================
function renderBookingsTable() {
  const tbody = document.getElementById('bookings-tbody');
  
  if (filteredBookings.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="11" style="text-align: center; padding: 3rem; color: #666;">
          📭 Nessuna prenotazione trovata con i filtri attuali
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filteredBookings.map(booking => {
    const isSelected = selectedBookings.has(booking.ID);
    const statusClass = getStatusClass(booking.Stato);
    const creationDate = formatDate(booking.DataCreazione);
    const pickupDate = formatDate(booking.DataRitiro);
    const returnDate = formatDate(booking.DataConsegna);
    
    return `
      <tr class="booking-row ${isSelected ? 'selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${booking.ID}" ${isSelected ? 'checked' : ''}></td>
        <td><strong>${booking.ID}</strong></td>
        <td>${creationDate}</td>
        <td>${booking.NomeCompleto || booking.Cliente || '-'}</td>
        <td>
          <div>${booking.CF || '-'}</div>
          <small style="color: #666;">${booking.Telefono || '-'}</small>
        </td>
        <td><strong>${booking.Targa || 'TBD'}</strong></td>
        <td>${pickupDate} ${booking.OraRitiro || ''}</td>
        <td>${returnDate} ${booking.OraConsegna || ''}</td>
        <td>${booking.Destinazione || '-'}</td>
        <td><span class="status-badge ${statusClass}">${booking.Stato}</span></td>
        <td>
          <div class="action-buttons">
            ${booking.Stato === 'Da confermare' ? `
              <button class="action-btn confirm" onclick="updateBookingStatus('${booking.ID}', 'Confermata')">✅</button>
              <button class="action-btn reject" onclick="updateBookingStatus('${booking.ID}', 'Annullata')">❌</button>
            ` : `
              <span style="color: #666; font-size: 0.8rem;">-</span>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event listeners to checkboxes
  tbody.querySelectorAll('.row-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleRowSelection);
  });
}

function formatDate(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
}

function getStatusClass(status) {
  const statusMap = {
    'Da confermare': 'status-pending',
    'Confermata': 'status-confirmed',
    'Annullata': 'status-cancelled'
  };
  return statusMap[status] || 'status-pending';
}

// =====================
// BULK ACTIONS
// =====================
function handleRowSelection(event) {
  const checkbox = event.target;
  const bookingId = checkbox.dataset.id;
  
  if (checkbox.checked) {
    selectedBookings.add(bookingId);
  } else {
    selectedBookings.delete(bookingId);
  }
  
  updateBulkActionsUI();
  updateSelectAllCheckbox();
}

function toggleSelectAll(event) {
  const isChecked = event.target.checked;
  
  if (isChecked) {
    // Select all filtered bookings
    filteredBookings.forEach(booking => {
      selectedBookings.add(booking.ID);
    });
  } else {
    // Deselect all
    selectedBookings.clear();
  }
  
  // Update individual checkboxes
  document.querySelectorAll('.row-checkbox').forEach(checkbox => {
    checkbox.checked = isChecked;
  });
  
  updateBulkActionsUI();
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all');
  const visibleBookingIds = filteredBookings.map(b => b.ID);
  const selectedVisibleCount = visibleBookingIds.filter(id => selectedBookings.has(id)).length;
  
  if (selectedVisibleCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedVisibleCount === visibleBookingIds.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

function updateBulkActionsUI() {
  const bulkActions = document.getElementById('bulk-actions');
  const selectedCount = document.getElementById('selected-count');
  const count = selectedBookings.size;
  
  if (count > 0) {
    bulkActions.classList.remove('hidden');
    selectedCount.textContent = `${count} selezionate`;
  } else {
    bulkActions.classList.add('hidden');
  }
}

async function bulkUpdateStatus(newStatus) {
  if (selectedBookings.size === 0) {
    showToast('Nessuna prenotazione selezionata', 'error');
    return;
  }
  
  const confirmMessage = `Confermi di voler ${newStatus === 'Confermata' ? 'confermare' : 'annullare'} ${selectedBookings.size} prenotazioni?`;
  
  if (!confirm(confirmMessage)) return;
  
  try {
    showToast(`Aggiornamento ${selectedBookings.size} prenotazioni...`, 'info');
    
    const promises = Array.from(selectedBookings).map(id => 
      callAPI('updateBookingStatus', { id, status: newStatus })
    );
    
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    
    if (successful > 0) {
      showToast(`✅ ${successful} prenotazioni aggiornate`, 'success');
      
      // Update local data
      allBookings.forEach(booking => {
        if (selectedBookings.has(booking.ID)) {
          booking.Stato = newStatus;
        }
      });
      
      // Clear selection and refresh
      selectedBookings.clear();
      applyFilters();
      updateStatistics();
      updateCharts();
    }
    
    if (results.length - successful > 0) {
      showToast(`⚠️ ${results.length - successful} errori`, 'error');
    }
    
  } catch (error) {
    console.error('Bulk update error:', error);
    showToast('Errore aggiornamento bulk', 'error');
  }
}

// =====================
// SINGLE ACTIONS
// =====================
async function updateBookingStatus(bookingId, newStatus) {
  try {
    const response = await callAPI('updateBookingStatus', { 
      id: bookingId, 
      status: newStatus 
    });
    
    if (response.success) {
      showToast(`✅ Prenotazione ${newStatus.toLowerCase()}`, 'success');
      
      // Update local data
      const booking = allBookings.find(b => b.ID === bookingId);
      if (booking) {
        booking.Stato = newStatus;
      }
      
      applyFilters();
      updateStatistics();
      updateCharts();
    } else {
      showToast('Errore aggiornamento', 'error');
    }
  } catch (error) {
    console.error('Update error:', error);
    showToast('Errore aggiornamento', 'error');
  }
}

// Make functions globally accessible
window.updateBookingStatus = updateBookingStatus;

// =====================
// EXCEL EXPORT
// =====================
function exportToExcel(filteredOnly = false) {
  const dataToExport = filteredOnly ? filteredBookings : allBookings;
  
  if (dataToExport.length === 0) {
    showToast('Nessun dato da esportare', 'error');
    return;
  }
  
  try {
    // Prepare data for export
    const exportData = dataToExport.map(booking => ({
      'ID': booking.ID,
      'Data Creazione': formatDate(booking.DataCreazione),
      'Cliente': booking.NomeCompleto || booking.Cliente || '',
      'Codice Fiscale': booking.CF || '',
      'Telefono': booking.Telefono || '',
      'Email': booking.Email || '',
      'Data Ritiro': formatDate(booking.DataRitiro),
      'Ora Ritiro': booking.OraRitiro || '',
      'Data Consegna': formatDate(booking.DataConsegna),
      'Ora Consegna': booking.OraConsegna || '',
      'Destinazione': booking.Destinazione || '',
      'Targa': booking.Targa || '',
      'Stato': booking.Stato,
      'Note': booking.Note || ''
    }));
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    const colWidths = [
      { wch: 15 }, // ID
      { wch: 12 }, // Data Creazione
      { wch: 20 }, // Cliente
      { wch: 16 }, // CF
      { wch: 15 }, // Telefono
      { wch: 25 }, // Email
      { wch: 12 }, // Data Ritiro
      { wch: 10 }, // Ora Ritiro
      { wch: 12 }, // Data Consegna
      { wch: 10 }, // Ora Consegna
      { wch: 20 }, // Destinazione
      { wch: 10 }, // Targa
      { wch: 15 }, // Stato
      { wch: 30 }  // Note
    ];
    ws['!cols'] = colWidths;
    
    // Add worksheet to workbook
    const sheetName = filteredOnly ? 'Prenotazioni Filtrate' : 'Tutte le Prenotazioni';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const filename = `Imbriani_Prenotazioni_${filteredOnly ? 'Filtrate_' : ''}${timestamp}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, filename);
    
    showToast(`📊 Esportate ${dataToExport.length} prenotazioni`, 'success');
    
  } catch (error) {
    console.error('Export error:', error);
    showToast('Errore durante l\'esportazione', 'error');
  }
}

// =====================
// STATISTICS
// =====================
function updateStatistics() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  // Today's bookings
  const todayBookings = allBookings.filter(booking => {
    const bookingDate = new Date(booking.DataCreazione || booking.DataRitiro);
    return bookingDate.toDateString() === today.toDateString();
  }).length;
  
  // This week's bookings
  const weekBookings = allBookings.filter(booking => {
    const bookingDate = new Date(booking.DataCreazione || booking.DataRitiro);
    return bookingDate >= weekAgo;
  }).length;
  
  // Active vehicles (from unique targas)
  const activeVehicles = new Set(allBookings.map(b => b.Targa).filter(t => t)).size;
  
  // Pending bookings
  const pendingBookings = allBookings.filter(b => b.Stato === 'Da confermare').length;
  
  // Update UI
  document.getElementById('stat-today').textContent = todayBookings;
  document.getElementById('stat-week').textContent = weekBookings;
  document.getElementById('stat-vehicles').textContent = activeVehicles;
  document.getElementById('stat-pending').textContent = pendingBookings;
}

// =====================
// CHARTS
// =====================
function updateCharts() {
  updateVehiclesChart();
  updateStatusChart();
}

function updateVehiclesChart() {
  const ctx = document.getElementById('vehicles-chart').getContext('2d');
  
  // Count bookings per vehicle
  const vehicleCounts = {};
  allBookings.forEach(booking => {
    if (booking.Targa) {
      vehicleCounts[booking.Targa] = (vehicleCounts[booking.Targa] || 0) + 1;
    }
  });
  
  const labels = Object.keys(vehicleCounts);
  const data = Object.values(vehicleCounts);
  
  if (vehiclesChart) {
    vehiclesChart.destroy();
  }
  
  vehiclesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Prenotazioni per Pulmino',
        data: data,
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function updateStatusChart() {
  const ctx = document.getElementById('status-chart').getContext('2d');
  
  // Count bookings per status
  const statusCounts = {};
  allBookings.forEach(booking => {
    const status = booking.Stato || 'Sconosciuto';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  const labels = Object.keys(statusCounts);
  const data = Object.values(statusCounts);
  const colors = labels.map(status => {
    switch (status) {
      case 'Confermata': return '#198754';
      case 'Da confermare': return '#ffc107';
      case 'Annullata': return '#dc3545';
      default: return '#6c757d';
    }
  });
  
  if (statusChart) {
    statusChart.destroy();
  }
  
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

// =====================
// UTILITIES
// =====================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => container.removeChild(toast), 300);
  }, duration);
}

console.log('%c✅ Admin Dashboard Pro loaded successfully!', 'color: #198754; font-weight: bold;');