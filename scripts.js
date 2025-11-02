let CURRENT_CF;
let SELECTED_VEHICLE = null;
let DRIVERS = [];

function showSpinner(show) {
    document.getElementById('spinner').classList.toggle('d-none', !show);
}

function toast(msg) {
    alert(msg); // semplice, si può sostituire con toast Bootstrap
}

function validateCF(cf) {
    return /^[A-Z0-9]{16}$/.test(cf);
}

function saveCF(cf) {
    localStorage.setItem('cf', cf);
}

function loadCF() {
    return localStorage.getItem('cf');
}

function renderBookings(bookings) {
    const list = document.getElementById('lista-prenotazioni');
    list.innerHTML = '';
    bookings.forEach(b => {
        const emoji = b.Stato === 'Confermata' ? '✅' : b.Stato === 'Annullata' ? '❌' : '⏳';
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.textContent = `${emoji} ${b.ID} ${b.DataRitiro} ${b.OraRitiro} → ${b.DataConsegna} ${b.OraConsegna} ${b.Targa || 'TBD'} (${b.Stato})`;
        list.appendChild(item);
    });
}

function renderVehicles(veicoli) {
    const wrap = document.getElementById('lista-veicoli');
    wrap.innerHTML = '';
    veicoli.filter(v => v.Posti >= 9 && v.Disponibile === true).forEach(v => {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        const card = document.createElement('div');
        card.className = 'vehicle';
        card.onclick = () => {
            document.querySelectorAll('#lista-veicoli .vehicle').forEach(e => e.classList.remove('active'));
            card.classList.add('active');
            SELECTED_VEHICLE = v;
            updateSummary();
        };
        card.innerHTML = `<strong>${v.Targa}</strong><br>${v.Marca} ${v.Modello} ${v.Colore}`;
        col.appendChild(card);
        wrap.appendChild(col);
    });
}

function driverRow(index, data) {
    return `
        <div class="row g-2 align-items-end driver" data-index="${index}">
            <div class="col-md-3"><input class="form-control" placeholder="Nome" value="${data.Nome}"></div>
            <div class="col-md-3"><input class="form-control" placeholder="Cognome" value="${data.Cognome}"></div>
            <div class="col-md-2"><input class="form-control" placeholder="CF" maxlength="16" value="${data.CF}"></div>
            <div class="col-md-2"><input type="date" class="form-control" placeholder="DataNascita" value="${data.DataNascita}"></div>
            <div class="col-md-2"><input class="form-control" placeholder="Patente" value="${data.NumeroPatente}"></div>
        </div>
    `;
}

function renderDrivers() {
    const cont = document.getElementById('drivers-container');
    cont.innerHTML = '';
    DRIVERS.forEach((d, i) => {
        cont.insertAdjacentHTML('beforeend', driverRow(i, d));
    });
}

function updateSummary() {
    const r = document.getElementById('riepilogo');
    const d1 = document.getElementById('data-ritiro').value;
    const o1 = document.getElementById('ora-ritiro').value;
    const d2 = document.getElementById('data-consegna').value;
    const o2 = document.getElementById('ora-consegna').value;
    const dest = document.getElementById('destinazione').value;
    const targa = SELECTED_VEHICLE ? SELECTED_VEHICLE.Targa : '';
    
    r.textContent = `Ritiro: ${d1} ${o1} | Consegna: ${d2} ${o2} | Dest: ${dest} | Targa: ${targa} | Autisti: ${DRIVERS.length}`;
}

async function doLogin() {
    const cf = document.getElementById('cf-input').value.toUpperCase();
    if (!validateCF(cf)) {
        return toast('CF non valido (16 caratteri A-Z0-9)');
    }
    
    showSpinner(true);
    try {
        const res = await callAPI('login', { token: APP_CONFIG.AUTH_TOKEN, cf });
        if (res.success) {
            CURRENT_CF = cf;
            saveCF(cf);
            document.getElementById('login-section').classList.add('d-none');
            document.getElementById('area-personale').classList.remove('d-none');
            await loadBookings();
            await loadAvailability();
        } else {
            toast(res.message || 'Errore login');
        }
    } catch (e) {
        toast('Errore rete');
    } finally {
        showSpinner(false);
    }
}

async function loadBookings() {
    const res = await callAPI('recuperaPrenotazioni', { token: APP_CONFIG.AUTH_TOKEN, cf: CURRENT_CF });
    if (res.success) {
        renderBookings(res.data);
    }
}

async function loadAvailability() {
    // semplice: carica tutti i veicoli e lascia filtro ≥9 posti + Disponibile
    const res = await callAPI('disponibilita', { token: APP_CONFIG.AUTH_TOKEN, dataInizio: '', dataFine: '' });
    if (res.success) {
        renderVehicles(res.data);
    }
}

async function createBooking() {
    const d1 = document.getElementById('data-ritiro').value;
    const o1 = document.getElementById('ora-ritiro').value;
    const d2 = document.getElementById('data-consegna').value;
    const o2 = document.getElementById('ora-consegna').value;
    const dest = document.getElementById('destinazione').value;
    
    if (!d1 || !d2 || !dest) {
        return toast('Compila date e destinazione');
    }
    if (!SELECTED_VEHICLE) {
        return toast('Seleziona un veicolo');
    }
    
    const payload = {
        action: 'creaPrenotazione',
        token: APP_CONFIG.AUTH_TOKEN,
        cf: CURRENT_CF,
        dataRitiro: d1,
        oraRitiro: o1,
        dataConsegna: d2,
        oraConsegna: o2,
        targa: SELECTED_VEHICLE.Targa,
        destinazione: dest,
        numAutisti: DRIVERS.length.toString(),
        drivers: encodeURIComponent(JSON.stringify(DRIVERS))
    };
    
    showSpinner(true);
    try {
        const res = await callAPI(payload);
        if (res.success) {
            toast('Prenotazione inviata!');
            await loadBookings();
        } else {
            toast(res.message || 'Errore creazione');
        }
    } catch (e) {
        toast('Errore rete');
    } finally {
        showSpinner(false);
    }
}

function init() {
    const saved = loadCF();
    if (validateCF(saved)) {
        document.getElementById('cf-input').value = saved;
    }
    
    document.getElementById('login-btn').onclick = doLogin;
    document.getElementById('add-driver').onclick = () => {
        if (DRIVERS.length >= 3) return toast('Max 3 autisti');
        if (DRIVERS.length === 0) {
            DRIVERS.push({});
        } else {
            DRIVERS.push({});
        }
        renderDrivers();
        updateSummary();
    };
    document.getElementById('conferma').onclick = createBooking;
    
    ['data-ritiro','ora-ritiro','data-consegna','ora-consegna','destinazione'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateSummary);
    });
    
    // almeno un autista obbligatorio
    DRIVERS = [{}];
    renderDrivers();
}

window.addEventListener('DOMContentLoaded', init);