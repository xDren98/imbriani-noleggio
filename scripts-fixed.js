let CURRENT_CF;
let SELECTED_VEHICLE = null;
let DRIVERS = [];

// Fix: Usa showLoader invece di showSpinner per compatibilità
function showSpinner(show) {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.toggle('d-none', !show);
    }
    // Compatibilità con shared-utils
    if (typeof showLoader === 'function') {
        showLoader(show);
    }
}

function toast(msg) {
    // Fix: Usa showToast se disponibile, altrimenti alert
    if (typeof showToast === 'function') {
        showToast(msg, 'info');
    } else {
        alert(msg);
    }
}

function validateCF(cf) {
    // Fix: Usa isValidCF se disponibile per consistenza
    if (typeof isValidCF === 'function') {
        return isValidCF(cf);
    }
    return /^[A-Z0-9]{16}$/.test(cf);
}

function saveCF(cf) {
    // Fix: Usa storage helper se disponibile
    if (typeof saveToStorage === 'function') {
        saveToStorage('cf', cf);
    } else {
        localStorage.setItem('cf', cf);
    }
}

function loadCF() {
    // Fix: Usa storage helper se disponibile
    if (typeof getFromStorage === 'function') {
        return getFromStorage('cf', '');
    }
    return localStorage.getItem('cf') || '';
}

function renderBookings(bookings) {
    const list = document.getElementById('lista-prenotazioni');
    if (!list) return;
    
    list.innerHTML = '';
    bookings.forEach(b => {
        // Fix: Usa helper se disponibile
        const emoji = typeof getStatoEmoji === 'function' ? 
            getStatoEmoji(b.Stato) : 
            (b.Stato === 'Confermata' ? '✅' : b.Stato === 'Annullata' ? '❌' : '⏳');
            
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.textContent = `${emoji} ${b.ID || 'N/A'} ${b.DataRitiro || ''} ${b.OraRitiro || ''} → ${b.DataConsegna || ''} ${b.OraConsegna || ''} ${b.Targa || 'TBD'} (${b.Stato || 'Da confermare'})`;
        list.appendChild(item);
    });
}

function renderVehicles(veicoli) {
    const wrap = document.getElementById('lista-veicoli');
    if (!wrap) return;
    
    wrap.innerHTML = '';
    veicoli.filter(v => v.Posti >= 9 && v.Disponibile === true).forEach(v => {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        const card = document.createElement('div');
        card.className = 'vehicle card p-2 m-1';
        card.style.cursor = 'pointer';
        card.onclick = () => {
            document.querySelectorAll('#lista-veicoli .vehicle').forEach(e => e.classList.remove('active', 'border-primary'));
            card.classList.add('active', 'border-primary');
            SELECTED_VEHICLE = v;
            updateSummary();
        };
        card.innerHTML = `<strong>${v.Targa}</strong><br><small>${v.Marca} ${v.Modello}</small><br><span class="text-muted">${v.Colore}</span>`;
        col.appendChild(card);
        wrap.appendChild(col);
    });
}

function driverRow(index, data) {
    return `
        <div class="row g-2 align-items-end driver mb-2" data-index="${index}">
            <div class="col-md-3"><input class="form-control driver-nome" placeholder="Nome" value="${data.Nome || ''}"></div>
            <div class="col-md-3"><input class="form-control driver-cognome" placeholder="Cognome" value="${data.Cognome || ''}"></div>
            <div class="col-md-2"><input class="form-control driver-cf" placeholder="CF" maxlength="16" value="${data.CF || ''}"></div>
            <div class="col-md-2"><input type="date" class="form-control driver-data" placeholder="Data Nascita" value="${data.DataNascita || ''}"></div>
            <div class="col-md-2"><input class="form-control driver-patente" placeholder="Patente" value="${data.NumeroPatente || ''}"></div>
        </div>
    `;
}

function renderDrivers() {
    const cont = document.getElementById('drivers-container');
    if (!cont) return;
    
    cont.innerHTML = '';
    DRIVERS.forEach((d, i) => {
        cont.insertAdjacentHTML('beforeend', driverRow(i, d));
    });
    
    // Fix: Aggiungi event listeners per aggiornare dati
    cont.querySelectorAll('.driver').forEach((row, index) => {
        row.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => updateDriverData(index));
        });
    });
}

function updateDriverData(index) {
    const row = document.querySelector(`[data-index="${index}"]`);
    if (!row || !DRIVERS[index]) return;
    
    DRIVERS[index] = {
        Nome: row.querySelector('.driver-nome').value,
        Cognome: row.querySelector('.driver-cognome').value,
        CF: row.querySelector('.driver-cf').value.toUpperCase(),
        DataNascita: row.querySelector('.driver-data').value,
        NumeroPatente: row.querySelector('.driver-patente').value
    };
    updateSummary();
}

function updateSummary() {
    const r = document.getElementById('riepilogo');
    if (!r) return;
    
    const d1 = document.getElementById('data-ritiro')?.value || '';
    const o1 = document.getElementById('ora-ritiro')?.value || '';
    const d2 = document.getElementById('data-consegna')?.value || '';
    const o2 = document.getElementById('ora-consegna')?.value || '';
    const dest = document.getElementById('destinazione')?.value || '';
    const targa = SELECTED_VEHICLE ? SELECTED_VEHICLE.Targa : 'Nessuno';
    
    r.innerHTML = `
        <strong>📅 Periodo:</strong> ${d1} ${o1} → ${d2} ${o2}<br>
        <strong>📍 Destinazione:</strong> ${dest}<br>
        <strong>🚐 Veicolo:</strong> ${targa}<br>
        <strong>👥 Autisti:</strong> ${DRIVERS.length}/3
    `;
}

// Fix: Correggi chiamata API per login
async function doLogin() {
    const cf = document.getElementById('cf-input')?.value?.toUpperCase() || '';
    if (!validateCF(cf)) {
        return toast('CF non valido (16 caratteri A-Z0-9)');
    }
    
    showSpinner(true);
    try {
        // Fix: Usa formato corretto per callAPI
        const res = await callAPI('login', { 
            token: APP_CONFIG.AUTH_TOKEN, 
            cf: cf 
        }, 'GET'); // GET per evitare CORS
        
        if (res && res.success) {
            CURRENT_CF = cf;
            saveCF(cf);
            document.getElementById('login-section')?.classList.add('d-none');
            document.getElementById('area-personale')?.classList.remove('d-none');
            await loadBookings();
            await loadAvailability();
            toast('Login effettuato con successo!');
        } else {
            toast(res?.message || 'Errore durante il login');
        }
    } catch (e) {
        console.error('Login error:', e);
        toast('Errore di connessione. Riprova.');
    } finally {
        showSpinner(false);
    }
}

// Fix: Correggi chiamata API per prenotazioni
async function loadBookings() {
    if (!CURRENT_CF) return;
    
    try {
        const res = await callAPI('recuperaPrenotazioni', { 
            token: APP_CONFIG.AUTH_TOKEN, 
            cf: CURRENT_CF 
        }, 'GET');
        
        if (res && res.success && Array.isArray(res.data)) {
            renderBookings(res.data);
        } else {
            console.warn('No bookings data:', res);
            renderBookings([]);
        }
    } catch (e) {
        console.error('Load bookings error:', e);
        renderBookings([]);
    }
}

// Fix: Correggi chiamata API per disponibilità
async function loadAvailability() {
    try {
        const res = await callAPI('disponibilita', { 
            token: APP_CONFIG.AUTH_TOKEN,
            dataInizio: '',
            dataFine: ''
        }, 'GET');
        
        if (res && res.success && Array.isArray(res.data)) {
            renderVehicles(res.data);
        } else {
            console.warn('No vehicles data:', res);
            renderVehicles([]);
        }
    } catch (e) {
        console.error('Load availability error:', e);
        renderVehicles([]);
    }
}

// Fix: Correggi completamente createBooking
async function createBooking() {
    const d1 = document.getElementById('data-ritiro')?.value || '';
    const o1 = document.getElementById('ora-ritiro')?.value || '';
    const d2 = document.getElementById('data-consegna')?.value || '';
    const o2 = document.getElementById('ora-consegna')?.value || '';
    const dest = document.getElementById('destinazione')?.value || '';
    
    // Validazioni
    if (!d1 || !d2 || !dest) {
        return toast('Compila tutti i campi obbligatori: date e destinazione');
    }
    if (!SELECTED_VEHICLE) {
        return toast('Seleziona un veicolo dalla lista');
    }
    if (DRIVERS.length === 0) {
        return toast('Aggiungi almeno un autista');
    }
    
    // Valida date
    const dataRitiro = new Date(d1);
    const dataConsegna = new Date(d2);
    if (dataConsegna <= dataRitiro) {
        return toast('La data di consegna deve essere successiva al ritiro');
    }
    
    // Valida autisti
    for (let i = 0; i < DRIVERS.length; i++) {
        const driver = DRIVERS[i];
        if (!driver.Nome || !driver.Cognome || !driver.CF) {
            return toast(`Completa i dati dell'autista ${i + 1}`);
        }
        if (!validateCF(driver.CF)) {
            return toast(`CF non valido per l'autista ${i + 1}`);
        }
    }
    
    showSpinner(true);
    try {
        // Fix: Usa formato corretto per creaPrenotazione
        const payload = {
            token: APP_CONFIG.AUTH_TOKEN,
            cf: CURRENT_CF,
            dataRitiro: d1,
            oraRitiro: o1,
            dataConsegna: d2,
            oraConsegna: o2,
            targa: SELECTED_VEHICLE.Targa,
            destinazione: dest,
            numAutisti: DRIVERS.length.toString(),
            drivers: JSON.stringify(DRIVERS)
        };
        
        const res = await callAPI('creaPrenotazione', payload, 'GET'); // GET per evitare CORS
        
        if (res && res.success) {
            toast('Prenotazione inviata con successo! Ti contatteremo presto.');
            // Reset form
            SELECTED_VEHICLE = null;
            DRIVERS = [{}];
            document.getElementById('data-ritiro').value = '';
            document.getElementById('ora-ritiro').value = '08:00';
            document.getElementById('data-consegna').value = '';
            document.getElementById('ora-consegna').value = '20:00';
            document.getElementById('destinazione').value = '';
            renderDrivers();
            renderVehicles([]);
            updateSummary();
            await loadBookings();
            await loadAvailability();
        } else {
            toast(res?.message || 'Errore durante la creazione della prenotazione');
        }
    } catch (e) {
        console.error('Create booking error:', e);
        toast('Errore di connessione. Riprova.');
    } finally {
        showSpinner(false);
    }
}

// Fix: Inizializzazione migliorata
function init() {
    console.log('🚀 Inizializzazione app...');
    
    // Carica CF salvato
    const saved = loadCF();
    if (validateCF(saved)) {
        const input = document.getElementById('cf-input');
        if (input) input.value = saved;
    }
    
    // Event listeners
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.onclick = doLogin;
    
    const addDriverBtn = document.getElementById('add-driver');
    if (addDriverBtn) {
        addDriverBtn.onclick = () => {
            if (DRIVERS.length >= 3) {
                return toast('Massimo 3 autisti consentiti');
            }
            DRIVERS.push({});
            renderDrivers();
            updateSummary();
        };
    }
    
    const confermaBtn = document.getElementById('conferma');
    if (confermaBtn) confermaBtn.onclick = createBooking;
    
    // Event listeners per aggiornamento riepilogo
    ['data-ritiro', 'ora-ritiro', 'data-consegna', 'ora-consegna', 'destinazione'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', updateSummary);
            elem.addEventListener('input', updateSummary);
        }
    });
    
    // Inizializza con un autista
    DRIVERS = [{}];
    renderDrivers();
    updateSummary();
    
    console.log('✅ App inizializzata correttamente');
}

// Inizializzazione sicura
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}