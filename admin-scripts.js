/* ================================================================================
   IMBRIANI NOLEGGIO - ADMIN SCRIPTS v8.0 (Anthracite/Azure Enhanced)
   Complete admin functionality with theme coordination and performance optimization
   ================================================================================ */

'use strict';

const ADMIN_VERSION = '8.0.0';
let allBookings = [];
let filteredBookings = [];
let selectedBookings = new Set();
let vehiclesChart = null;
let statusChart = null;

console.log(`%c🔧 Admin Dashboard Pro v${ADMIN_VERSION} (Anthracite/Azure)`, 'font-size: 16px; font-weight: bold; color: #3f7ec7;');

// =====================
// INITIALIZATION
// =====================
document.addEventListener('DOMContentLoaded', () => {
  initializeDashboard();
  loadAllData();
  setupEventListeners();
  startClock();
  
  // Theme coordination check
  console.log('🎨 Theme coordination: Anthracite/Azure active');
});

function initializeDashboard() {
  console.log('🚀 Initializing Admin Dashboard Pro v8.0...');
  
  // Set default date filters (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  document.getElementById('filter-date-from').value = thirtyDaysAgo.toISOString().slice(0, 10);
  document.getElementById('filter-date-to').value = today.toISOString().slice(0, 10);
  
  // Load mock data for demo
  loadMockData();
  
  showToast('🎨 Dashboard Pro v8.0 inizializzata', 'success');
}

function loadMockData() {
  // Enhanced mock data with more realistic entries
  allBookings = [
    {
      ID: 'BOOK-2025-059',
      DataCreazione: '2025-10-03',
      NomeCompleto: 'Paolo Calasso',
      CF: 'CLSPLA83E06C978M',
      Telefono: '328702448',
      Email: 'paolo.calasso@email.it',
      Targa: 'DN391FW',
      DataRitiro: '2025-10-03',
      OraRitiro: '18:00',
      DataConsegna: '2025-10-06',
      OraConsegna: '10:00',
      Destinazione: 'Roma Centro',
      Stato: 'Da confermare',
      Note: 'Richiesta transfer aeroporto'
    },
    {
      ID: 'BOOK-2025-060',
      DataCreazione: '2025-10-03',
      NomeCompleto: 'Marco Bianchi',
      CF: 'BNCMRC82B15H501K',
      Telefono: '339123456',
      Email: 'marco.bianchi@email.it',
      Targa: 'DL291XZ',
      DataRitiro: '2025-10-03',
      OraRitiro: '17:00',
      DataConsegna: '2025-10-05',
      OraConsegna: '08:00',
      Destinazione: 'Ostia Lido',
      Stato: 'Confermata',
      Note: 'Cliente abituale'
    },
    {
      ID: 'BOOK-2025-061',
      DataCreazione: '2025-10-04',
      NomeCompleto: 'Daniel Vernich',
      CF: 'VRNDNL79F29FC842K',
      Telefono: '393367475',
      Email: 'daniel.vernich@gmail.com',
      Targa: 'EC787NM',
      DataRitiro: '2025-10-05',
      OraRitiro: '08:00',
      DataConsegna: '2025-10-05',
      OraConsegna: '20:00',
      Destinazione: 'Aeroporto Fiumicino',
      Stato: 'Da confermare',
      Note: 'Volo internazionale'
    },
    {
      ID: 'BOOK-2025-062',
      DataCreazione: '2025-10-02',
      NomeCompleto: 'Laura Rossi',
      CF: 'RSSLRA88D52H501Y',
      Telefono: '347789123',
      Email: 'laura.rossi@outlook.it',
      Targa: 'FG456HJ',
      DataRitiro: '2025-10-02',
      OraRitiro: '15:00',
      DataConsegna: '2025-10-04',
      OraConsegna: '18:00',
      Destinazione: 'Napoli',
      Stato: 'Annullata',
      Note: 'Cancellazione cliente'
    }
  ];
  
  filteredBookings = [...allBookings];
  
  // Update everything
  updateStatistics();
  renderBookingsTable();
  updateVehicleFilter();
  updateCharts();
  
  console.log(`📋 Loaded ${allBookings.length} bookings (including mock data)`);
}

function setupEventListeners() {
  // Filter actions
  document.getElementById('apply-filters')?.addEventListener('click', applyFilters);
  document.getElementById('clear-filters')?.addEventListener('click', clearFilters);
  
  // Bulk actions
  document.getElementById('select-all')?.addEventListener('change', toggleSelectAll);
  document.getElementById('bulk-confirm')?.addEventListener('click', () => bulkUpdateStatus('Confermata'));
  document.getElementById('bulk-reject')?.addEventListener('click', () => bulkUpdateStatus('Annullata'));
  
  // Export actions
  document.getElementById('export-excel')?.addEventListener('click', exportToExcel);
  document.getElementById('export-filtered')?.addEventListener('click', () => exportToExcel(true));
  
  // Refresh
  document.getElementById('refresh-all')?.addEventListener('click', () => {
    showToast('🔄 Aggiornamento dati...', 'info');
    loadMockData();
  });
  
  // Live search client filter with debounce
  document.getElementById('filter-client')?.addEventListener('input', debounce(applyFilters, 300));
  
  console.log('🔗 Event listeners setup complete');
}

function startClock() {
  function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
      timeElement.textContent = timeString;
    }
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

// =====================
// DATA FILTERING
// =====================
function updateVehicleFilter() {
  const select = document.getElementById('filter-vehicle');
  if (!select) return;
  
  const vehicles = [...new Set(allBookings.map(b => b.Targa).filter(t => t))].sort();
  
  select.innerHTML = '<option value="">Tutti i pulmini</option>' +
    vehicles.map(v => `<option value="${v}">${v}</option>`).join('');
}

function applyFilters() {
  const filters = {
    dateFrom: document.getElementById('filter-date-from')?.value,
    dateTo: document.getElementById('filter-date-to')?.value,
    status: document.getElementById('filter-status')?.value,
    vehicle: document.getElementById('filter-vehicle')?.value,
    client: document.getElementById('filter-client')?.value.toLowerCase().trim()
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
      toDate.setHours(23, 59, 59, 999);
      if (bookingDate > toDate) return false;
    }
    
    // Status filter
    if (filters.status && booking.Stato !== filters.status) return false;
    
    // Vehicle filter
    if (filters.vehicle && booking.Targa !== filters.vehicle) return false;
    
    // Client filter
    if (filters.client) {
      const clientName = (booking.NomeCompleto || '').toLowerCase();
      if (!clientName.includes(filters.client)) return false;
    }
    
    return true;
  });
  
  renderBookingsTable();
  updateCharts();
  
  if (filteredBookings.length !== allBookings.length) {
    showToast(`🔍 Mostrate ${filteredBookings.length} di ${allBookings.length} prenotazioni`, 'info');
  }
}

function clearFilters() {
  ['filter-date-from', 'filter-date-to', 'filter-status', 'filter-vehicle', 'filter-client']
    .forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
  
  applyFilters();
  showToast('🗑️ Filtri rimossi', 'info');
}

// =====================
// TABLE RENDERING
// =====================
function renderBookingsTable() {
  const tbody = document.getElementById('bookings-tbody');
  if (!tbody) return;
  
  if (filteredBookings.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="11" style="text-align: center; padding: 3rem; color: var(--anthracite-200);">
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
    const pickupDateTime = `${formatDate(booking.DataRitiro)}<br><small style="color: #9ca3af;">${booking.OraRitiro || ''}</small>`;
    const returnDateTime = `${formatDate(booking.DataConsegna)}<br><small style="color: #9ca3af;">${booking.OraConsegna || ''}</small>`;
    
    return `
      <tr class="booking-row ${isSelected ? 'selected' : ''}" data-booking-id="${booking.ID}">
        <td><input type="checkbox" class="row-checkbox" data-id="${booking.ID}" ${isSelected ? 'checked' : ''}></td>
        <td><strong style="color: #3f7ec7;">${booking.ID}</strong></td>
        <td>${creationDate}</td>
        <td>${booking.NomeCompleto || '-'}</td>
        <td>
          ${booking.CF || '-'}<br>
          <small style="color: #9ca3af;">${booking.Telefono || '-'}</small>
        </td>
        <td><strong style="color: #22c55e;">${booking.Targa || 'TBD'}</strong></td>
        <td>${pickupDateTime}</td>
        <td>${returnDateTime}</td>
        <td>${booking.Destinazione || '-'}</td>
        <td><span class="status-badge ${statusClass}">${booking.Stato}</span></td>
        <td>
          <div class="action-buttons">
            ${booking.Stato === 'Da confermare' ? `
              <button class="action-btn confirm" onclick="updateBookingStatus('${booking.ID}', 'Confermata')" title="Conferma">✅</button>
              <button class="action-btn reject" onclick="updateBookingStatus('${booking.ID}', 'Annullata')" title="Annulla">❌</button>
            ` : `
              <span style="color: #9ca3af; font-size: 0.8rem;">-</span>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Re-attach checkbox event listeners
  setupTableCheckboxes();
}

function setupTableCheckboxes() {
  document.querySelectorAll('.row-checkbox').forEach(checkbox => {
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
// STATISTICS
// =====================
function updateStatistics() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  // Calculate stats
  const todayBookings = allBookings.filter(booking => {
    const bookingDate = booking.DataCreazione || booking.DataRitiro;
    return bookingDate === todayStr;
  }).length;
  
  const weekBookings = allBookings.filter(booking => {
    const bookingDate = new Date(booking.DataCreazione || booking.DataRitiro);
    return bookingDate >= weekAgo;
  }).length;
  
  const activeVehicles = new Set(allBookings.map(b => b.Targa).filter(t => t)).size;
  const pendingBookings = allBookings.filter(b => b.Stato === 'Da confermare').length;
  
  // Animate updates
  animateStatNumber('stat-today', todayBookings);
  animateStatNumber('stat-week', weekBookings);
  animateStatNumber('stat-vehicles', activeVehicles);
  animateStatNumber('stat-pending', pendingBookings);
}

function animateStatNumber(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const startValue = parseInt(element.textContent) || 0;
  const duration = 800;
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentValue = Math.round(startValue + (targetValue - startValue) * easeOutQuart);
    
    element.textContent = currentValue;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
}

// =====================
// BULK ACTIONS
// =====================
function handleRowSelection(event) {
  const checkbox = event.target;
  const bookingId = checkbox.dataset.id;
  const row = checkbox.closest('tr');
  
  if (checkbox.checked) {
    selectedBookings.add(bookingId);
    row.classList.add('selected');
  } else {
    selectedBookings.delete(bookingId);
    row.classList.remove('selected');
  }
  
  updateBulkActionsUI();
  updateSelectAllCheckbox();
}

function toggleSelectAll(event) {
  const isChecked = event.target.checked;
  
  // Clear selection first
  selectedBookings.clear();
  
  if (isChecked) {
    // Select all filtered bookings
    filteredBookings.forEach(booking => {
      selectedBookings.add(booking.ID);
    });
  }
  
  // Update individual checkboxes
  document.querySelectorAll('.row-checkbox').forEach(checkbox => {
    checkbox.checked = isChecked;
    const row = checkbox.closest('tr');
    if (isChecked) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  });
  
  updateBulkActionsUI();
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all');
  if (!selectAllCheckbox) return;
  
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
    bulkActions?.classList.remove('hidden');
    if (selectedCount) {
      selectedCount.textContent = `${count} selezionate`;
    }
  } else {
    bulkActions?.classList.add('hidden');
  }
}

async function bulkUpdateStatus(newStatus) {
  if (selectedBookings.size === 0) {
    showToast('❌ Nessuna prenotazione selezionata', 'error');
    return;
  }
  
  const actionText = newStatus === 'Confermata' ? 'confermare' : 'annullare';
  const confirmMessage = `Confermi di voler ${actionText} ${selectedBookings.size} prenotazioni?`;
  
  if (!confirm(confirmMessage)) return;
  
  try {
    showToast(`⏳ Aggiornamento ${selectedBookings.size} prenotazioni...`, 'info');
    
    let successful = 0;
    
    // Update local data (simulate API calls)
    selectedBookings.forEach(bookingId => {
      const booking = allBookings.find(b => b.ID === bookingId);
      if (booking) {
        booking.Stato = newStatus;
        successful++;
      }
    });
    
    // Clear selection and refresh
    selectedBookings.clear();
    applyFilters();
    updateStatistics();
    updateCharts();
    updateBulkActionsUI();
    
    const emoji = newStatus === 'Confermata' ? '✅' : '❌';
    showToast(`${emoji} ${successful} prenotazioni ${newStatus.toLowerCase()}e`, 'success');
    
  } catch (error) {
    console.error('Bulk update error:', error);
    showToast('❌ Errore aggiornamento bulk', 'error');
  }
}

// =====================
// SINGLE ACTIONS
// =====================
async function updateBookingStatus(bookingId, newStatus) {
  try {
    // Update local data (simulate API call)
    const booking = allBookings.find(b => b.ID === bookingId);
    if (booking) {
      booking.Stato = newStatus;
      
      const emoji = newStatus === 'Confermata' ? '✅' : '❌';
      showToast(`${emoji} ${bookingId} ${newStatus.toLowerCase()}`, 'success');
      
      // Refresh display
      applyFilters();
      updateStatistics();
      updateCharts();
    }
  } catch (error) {
    console.error('Update error:', error);
    showToast('❌ Errore aggiornamento', 'error');
  }
}

// Make globally accessible
window.updateBookingStatus = updateBookingStatus;

// =====================
// EXCEL EXPORT
// =====================
function exportToExcel(filteredOnly = false) {
  if (typeof XLSX === 'undefined') {
    showToast('❌ Libreria Excel non disponibile', 'error');
    return;
  }
  
  const dataToExport = filteredOnly ? filteredBookings : allBookings;
  
  if (dataToExport.length === 0) {
    showToast('❌ Nessun dato da esportare', 'error');
    return;
  }
  
  try {
    // Prepare export data
    const exportData = dataToExport.map(booking => ({
      'ID Prenotazione': booking.ID,
      'Data Creazione': formatDate(booking.DataCreazione),
      'Nome Cliente': booking.NomeCompleto || '',
      'Codice Fiscale': booking.CF || '',
      'Telefono': booking.Telefono || '',
      'Email': booking.Email || '',
      'Pulmino (Targa)': booking.Targa || '',
      'Data Ritiro': formatDate(booking.DataRitiro),
      'Ora Ritiro': booking.OraRitiro || '',
      'Data Consegna': formatDate(booking.DataConsegna),
      'Ora Consegna': booking.OraConsegna || '',
      'Destinazione': booking.Destinazione || '',
      'Stato': booking.Stato,
      'Note': booking.Note || ''
    }));
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 15 },
      { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 30 }
    ];
    
    // Add worksheet
    const sheetName = filteredOnly ? 'Prenotazioni_Filtrate' : 'Tutte_Prenotazioni';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const prefix = filteredOnly ? 'Filtrate' : 'Complete';
    const filename = `Imbriani_Prenotazioni_${prefix}_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    
    showToast(`📊 Esportate ${dataToExport.length} prenotazioni`, 'success');
    
  } catch (error) {
    console.error('Export error:', error);
    showToast('❌ Errore durante esportazione', 'error');
  }
}

// =====================
// CHARTS - ANTHRACITE THEME
// =====================
function loadAllData() {
  console.log('📊 Loading data and initializing charts...');
  loadMockData();
  
  // Initialize charts after data loads
  setTimeout(() => {
    initializeCharts();
  }, 100);
}

function initializeCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('⚠️ Chart.js not loaded, skipping chart initialization');
    return;
  }
  
  // Destroy existing charts
  if (vehiclesChart) vehiclesChart.destroy();
  if (statusChart) statusChart.destroy();
  
  // Chart.js default settings for dark theme
  Chart.defaults.color = '#e5e7eb';
  Chart.defaults.backgroundColor = 'rgba(63, 126, 199, 0.8)';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
  
  setupVehiclesChart();
  setupStatusChart();
  
  console.log('📈 Charts initialized with Anthracite/Azure theme');
}

function setupVehiclesChart() {
  const canvas = document.getElementById('vehicles-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Vehicle usage data
  const vehicleCounts = {};
  allBookings.forEach(booking => {
    if (booking.Targa) {
      vehicleCounts[booking.Targa] = (vehicleCounts[booking.Targa] || 0) + 1;
    }
  });
  
  const labels = Object.keys(vehicleCounts);
  const data = Object.values(vehicleCounts);
  const colors = [
    'rgba(63, 126, 199, 0.8)',   // Brand Azure
    'rgba(77, 118, 255, 0.8)',   // Brand Azure Light
    'rgba(34, 197, 94, 0.8)',    // Success Green
    'rgba(245, 158, 11, 0.8)',   // Warning Yellow
    'rgba(168, 85, 247, 0.8)'    // Purple accent
  ];
  
  vehiclesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: colors.slice(0, labels.length).map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#e5e7eb',
            padding: 15,
            font: { size: 12 },
            usePointStyle: true
          }
        }
      }
    }
  });
}

function setupStatusChart() {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Status distribution
  const statusCounts = {};
  allBookings.forEach(booking => {
    const status = booking.Stato || 'Sconosciuto';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  const labels = Object.keys(statusCounts);
  const data = Object.values(statusCounts);
  const colors = labels.map(status => {
    switch (status) {
      case 'Confermata': return 'rgba(34, 197, 94, 0.8)';
      case 'Da confermare': return 'rgba(245, 158, 11, 0.8)';
      case 'Annullata': return 'rgba(239, 68, 68, 0.8)';
      default: return 'rgba(156, 163, 175, 0.8)';
    }
  });
  
  statusChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Prenotazioni',
        data: data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.8', '1')),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#e5e7eb' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        y: {
          beginAtZero: true,
          ticks: { 
            color: '#e5e7eb',
            stepSize: 1
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function updateCharts() {
  // Update vehicles chart with filtered data
  if (vehiclesChart) {
    const vehicleCounts = {};
    filteredBookings.forEach(booking => {
      if (booking.Targa) {
        vehicleCounts[booking.Targa] = (vehicleCounts[booking.Targa] || 0) + 1;
      }
    });
    
    vehiclesChart.data.labels = Object.keys(vehicleCounts);
    vehiclesChart.data.datasets[0].data = Object.values(vehicleCounts);
    vehiclesChart.update('none'); // No animation for better performance
  }
  
  // Update status chart with filtered data
  if (statusChart) {
    const statusCounts = {};
    filteredBookings.forEach(booking => {
      const status = booking.Stato || 'Sconosciuto';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    statusChart.data.labels = Object.keys(statusCounts);
    statusChart.data.datasets[0].data = Object.values(statusCounts);
    statusChart.update('none');
  }
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

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.log(`Toast: ${message}`);
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Enhanced toast content
  const icons = {
    success: '✅',
    error: '❌', 
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// Enhanced toast styling in CSS
const toastStyles = `
.toast-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toast-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}
`;

// Inject enhanced styles
if (!document.getElementById('toast-enhanced-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-enhanced-styles';
  style.textContent = toastStyles;
  document.head.appendChild(style);
}

console.log('%c✅ Admin Scripts v8.0 fully loaded with Anthracite/Azure theme!', 'color: #22c55e; font-weight: bold; font-size: 14px;');