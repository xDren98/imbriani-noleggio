# 🚀 Google Apps Script Backend - Setup Completo v2.0

## 📋 Prerequisiti

✅ **Fogli Google Sheets richiesti** (con nomi esatti):
- "Risposte del modulo 1" - Prenotazioni e dati clienti
- "Gestione Pulmini" - Flotta veicoli

✅ **Token sincronizzato**: `imbriani_secret_2025`

---

## 📄 Codice Google Apps Script (copia-incolla completo)

Crea un nuovo progetto su [script.google.com](https://script.google.com) e incolla questo codice:

```javascript
// ====== CONFIGURAZIONE ======
const SHEET_ID = '1VAUJNVwxX8OLrkQVJP7IEGrqLIrDjJjrhfr7ABVqtns';            // ← 🔑 incolla il tuo Sheet ID qui
const AUTH_TOKEN = 'imbriani_secret_2025';        // ← deve combaciare col frontend
const TIMEZONE = 'Europe/Rome';

// Nomi fogli (struttura esistente)
const S_PRENOTAZIONI = 'Risposte del modulo 1';
const S_VEICOLI      = 'Gestione Pulmini';

// ====== UTILS ======
function sheet(name){ return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); }
function ok(data, message='Operazione completata'){ return json({ success:true, message, data }); }
function err(message, code=400){ return json({ success:false, message, code }); }
function json(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function today(fmt){ return Utilities.formatDate(new Date(), TIMEZONE, fmt||'yyyy-MM-dd'); }

// ====== ENTRYPOINT ======
function doGet(e){
  try{
    const q = e.parameter || {};
    if (q.action === 'options') return ok(null, 'OK');
    if (q.token !== AUTH_TOKEN) return err('Unauthorized', 401);

    switch(q.action){
      // USER APIs (existing)
      case 'login':                return handleLogin(q);
      case 'creaPrenotazione':     return handleCreaPrenotazione(q);
      case 'recuperaPrenotazioni': return handleRecuperaPrenotazioni(q);
      case 'disponibilita':        return handleDisponibilita(q);
      case 'modificaStato':        return handleModificaStato(q);
      
      // ADMIN APIs (new v2.0)
      case 'getAllBookings':       return handleGetAllBookings(q);
      case 'getAllVehicles':       return handleGetAllVehicles(q);
      case 'updateBookingStatus':  return handleUpdateBookingStatus(q);
      
      default: return err('Azione non supportata');
    }
  } catch(ex){
    Logger.log('doGet error: ' + ex.toString());
    return err('Errore server: ' + ex.toString());
  }
}

// ====== USER ACTIONS (existing) ======
function handleLogin(q){
  const cf = (q.cf||'').toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cf)) return err('CF non valido');

  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');

  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const idxCF = header.indexOf('Codice fiscale');

  // Cerca un record del cliente
  let cliente = null;
  for (const r of data){
    if ((r[idxCF]||'').toString().toUpperCase() === cf){
      cliente = {
        CF: cf,
        Nome: r[header.indexOf('Nome')] || '',
        Email: r[header.indexOf('Email')] || '',
        Cellulare: r[header.indexOf('Cellulare')] || ''
      };
      break;
    }
  }

  if (!cliente){ cliente = { CF: cf, Nome: '', Email: '', Cellulare: '' }; }
  return ok(cliente);
}

function handleCreaPrenotazione(q){
  const required = ['cf','dataRitiro','oraRitiro','dataConsegna','oraConsegna','targa','destinazione'];
  for (const k of required) if (!q[k]) return err('Parametro mancante: '+k);

  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');

  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const idxID = header.indexOf('ID prenotazione');

  // Nuovo ID
  let maxId = 0;
  for (const r of data){
    const id = parseInt(r[idxID],10);
    if (!isNaN(id) && id > maxId) maxId = id;
  }
  const newId = maxId + 1;

  // Autisti multipli
  const drivers = q.drivers ? JSON.parse(decodeURIComponent(q.drivers)) : [];
  const d1 = drivers[0] || {};
  const d2 = drivers[1] || {};
  const d3 = drivers[2] || {};

  // Prepara riga secondo intestazioni reali
  const row = new Array(header.length).fill('');
  header.forEach((col, i) => {
    switch(col){
      case 'Informazioni cronologiche': row[i] = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); break;
      case 'Nome': row[i] = d1.Nome || ''; break;
      case 'Data di nascita': row[i] = d1.DataNascita || ''; break;
      case 'Luogo di nascita': row[i] = d1.LuogoNascita || ''; break;
      case 'Codice fiscale': row[i] = (q.cf||'').toUpperCase(); break;
      case 'Comune di residenza': row[i] = d1.ComuneResidenza || ''; break;
      case 'Via di residenza': row[i] = d1.ViaResidenza || ''; break;
      case 'Civico di residenza': row[i] = d1.CivicoResidenza || ''; break;
      case 'Numero di patente': row[i] = d1.NumeroPatente || ''; break;
      case 'Data inizio validità patente': row[i] = d1.InizioPatente || ''; break;
      case 'Scadenza patente': row[i] = d1.ScadenzaPatente || ''; break;
      case 'Targa': row[i] = q.targa; break;
      case 'Ora inizio noleggio': row[i] = q.oraRitiro; break;
      case 'Ora fine noleggio': row[i] = q.oraConsegna; break;
      case 'Giorno inizio noleggio': row[i] = q.dataRitiro; break;
      case 'Giorno fine noleggio': row[i] = q.dataConsegna; break;
      case 'Destinazione': row[i] = q.destinazione; break;
      case 'Cellulare': row[i] = d1.Cellulare || ''; break;
      case 'Data contratto': row[i] = today(); break;

      case 'Nome Autista 2': row[i] = d2.Nome || ''; break;
      case 'Data di nascita Autista 2': row[i] = d2.DataNascita || ''; break;
      case 'Luogo di nascita Autista 2': row[i] = d2.LuogoNascita || ''; break;
      case 'Codice fiscale Autista 2': row[i] = d2.CF || ''; break;
      case 'Numero di patente Autista 2': row[i] = d2.NumeroPatente || ''; break;
      case 'Scadenza patente Autista 2': row[i] = d2.ScadenzaPatente || ''; break;

      case 'Nome Autista 3': row[i] = d3.Nome || ''; break;
      case 'Data di nascita Autista 3': row[i] = d3.DataNascita || ''; break;
      case 'Luogo di nascita Autista 3': row[i] = d3.LuogoNascita || ''; break;
      case 'Codice fiscale Autista 3': row[i] = d3.CF || ''; break;
      case 'Numero di patente Autista 3': row[i] = d3.NumeroPatente || ''; break;
      case 'Scadenza patente Autista 3': row[i] = d3.ScadenzaPatente || ''; break;

      case 'ID prenotazione': row[i] = newId; break;
      case 'Stato prenotazione': row[i] = 'Da Confermare'; break;
      case 'Importo preventivo': row[i] = ''; break;
      case 'Email': row[i] = d1.Email || ''; break;
    }
  });

  sh.appendRow(row);
  return ok({ id:newId });
}

function handleRecuperaPrenotazioni(q){
  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');
  const all = sh.getDataRange().getValues();
  const header = all.shift();

  let rows = all.map(r => ({
    ID: r[header.indexOf('ID prenotazione')] || '',
    CF: r[header.indexOf('Codice fiscale')] || '',
    DataRitiro: r[header.indexOf('Giorno inizio noleggio')] || '',
    OraRitiro: r[header.indexOf('Ora inizio noleggio')] || '',
    DataConsegna: r[header.indexOf('Giorno fine noleggio')] || '',
    OraConsegna: r[header.indexOf('Ora fine noleggio')] || '',
    Targa: r[header.indexOf('Targa')] || '',
    Destinazione: r[header.indexOf('Destinazione')] || '',
    Stato: r[header.indexOf('Stato prenotazione')] || 'Da Confermare',
    DataCreazione: r[header.indexOf('Data contratto')] || '',
    Nome: r[header.indexOf('Nome')] || '',
    Cellulare: r[header.indexOf('Cellulare')] || '',
    Email: r[header.indexOf('Email')] || ''
  }));

  if ((q.cf||'').toUpperCase() !== 'ALL'){
    const cf = (q.cf||'').toUpperCase();
    rows = rows.filter(r => (r.CF||'').toUpperCase() === cf);
  }
  if (q.stato){ rows = rows.filter(r => (r.Stato||'') === q.stato); }

  return ok(rows);
}

function handleDisponibilita(q){
  const sh = sheet(S_VEICOLI);
  if (!sh) return err('Foglio veicoli mancante');
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const rows = data.map(r => ({
    Targa: r[header.indexOf('Targa')] || '',
    Marca: r[header.indexOf('Marca')] || '',
    Modello: r[header.indexOf('Modello')] || '',
    Posti: r[header.indexOf('Posti')] || '',
    Disponibile: String(r[header.indexOf('Stato')]||'').toLowerCase() === 'disponibile',
    Note: r[header.indexOf('Note')] || ''
  }));
  return ok(rows.filter(v => String(v.Posti)==='9' && v.Disponibile===true));
}

function handleModificaStato(q){
  const id = parseInt(q.id,10);
  const nuovo = q.stato||'';
  if (!id || !nuovo) return err('Parametri mancanti');

  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const idxID = header.indexOf('ID prenotazione');
  const idxStato = header.indexOf('Stato prenotazione');

  for (let i=0;i<data.length;i++){
    const cur = parseInt(data[i][idxID],10);
    if (cur === id){
      sh.getRange(i+2, idxStato+1).setValue(nuovo);
      return ok({ id, stato: nuovo });
    }
  }
  return err('ID non trovato');
}

// ====== 🆕 ADMIN APIs v2.0 ======

// Get all bookings for admin dashboard
function handleGetAllBookings(q){
  try {
    const sh = sheet(S_PRENOTAZIONI);
    if (!sh) return err('Foglio prenotazioni mancante');
    
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return ok([]);
    
    const header = data.shift();
    
    const bookings = data.map(row => {
      const booking = {};
      header.forEach((col, index) => {
        // Map column names to frontend-expected field names
        switch(col) {
          case 'ID prenotazione': booking.ID = row[index] || ''; break;
          case 'Informazioni cronologiche': booking.DataCreazione = row[index] || ''; break;
          case 'Nome': booking.NomeCompleto = row[index] || ''; break;
          case 'Codice fiscale': booking.CF = row[index] || ''; break;
          case 'Cellulare': booking.Telefono = row[index] || ''; break;
          case 'Email': booking.Email = row[index] || ''; break;
          case 'Giorno inizio noleggio': booking.DataRitiro = row[index] || ''; break;
          case 'Ora inizio noleggio': booking.OraRitiro = row[index] || ''; break;
          case 'Giorno fine noleggio': booking.DataConsegna = row[index] || ''; break;
          case 'Ora fine noleggio': booking.OraConsegna = row[index] || ''; break;
          case 'Destinazione': booking.Destinazione = row[index] || ''; break;
          case 'Targa': booking.Targa = row[index] || ''; break;
          case 'Stato prenotazione': booking.Stato = row[index] || 'Da confermare'; break;
          default: booking[col] = row[index] || ''; break;
        }
      });
      return booking;
    }).filter(b => b.ID); // Filter out empty rows
    
    Logger.log(`📊 Admin: getAllBookings returned ${bookings.length} records`);
    return ok(bookings);
    
  } catch (error) {
    Logger.log('getAllBookings error: ' + error.toString());
    return err('Errore caricamento prenotazioni admin');
  }
}

// Get all vehicles for admin filters
function handleGetAllVehicles(q){
  try {
    const sh = sheet(S_VEICOLI);
    if (!sh) return err('Foglio veicoli mancante');
    
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return ok([]);
    
    const header = data.shift();
    
    const vehicles = data.map(row => {
      const vehicle = {};
      header.forEach((col, index) => {
        vehicle[col] = row[index] || '';
      });
      return vehicle;
    }).filter(v => v.Targa); // Filter out empty rows
    
    Logger.log(`🚐 Admin: getAllVehicles returned ${vehicles.length} vehicles`);
    return ok(vehicles);
    
  } catch (error) {
    Logger.log('getAllVehicles error: ' + error.toString());
    return err('Errore caricamento veicoli admin');
  }
}

// Update booking status (admin confirm/reject)
function handleUpdateBookingStatus(q){
  try {
    const id = q.id;
    const status = q.status;
    
    if (!id || !status) {
      return err('Parametri mancanti: id, status');
    }
    
    const sh = sheet(S_PRENOTAZIONI);
    if (!sh) return err('Foglio prenotazioni mancante');
    
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return err('Nessuna prenotazione trovata');
    
    const header = data[0];
    const idIndex = header.indexOf('ID prenotazione');
    const statusIndex = header.indexOf('Stato prenotazione');
    
    if (idIndex === -1 || statusIndex === -1) {
      return err('Colonne ID prenotazione o Stato prenotazione non trovate');
    }
    
    // Find and update the booking
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === String(id)) {
        sh.getRange(i + 1, statusIndex + 1).setValue(status);
        
        // Also update timestamp if "Data aggiornamento" column exists
        const updateIndex = header.indexOf('Data aggiornamento');
        if (updateIndex !== -1) {
          sh.getRange(i + 1, updateIndex + 1).setValue(today('yyyy-MM-dd HH:mm:ss'));
        }
        
        Logger.log(`✅ Updated booking ${id} to status: ${status}`);
        return ok({ id, status, message: `Prenotazione ${id} aggiornata a: ${status}` });
      }
    }
    
    return err(`Prenotazione ${id} non trovata`);
    
  } catch (error) {
    Logger.log('updateBookingStatus error: ' + error.toString());
    return err('Errore aggiornamento stato');
  }
}
```

---

## 🔧 Deploy Web App (4 step)

### 1️⃣ **Sostituisci SHEET_ID**
Nella costante `SHEET_ID`, incolla l'ID del tuo Google Sheets:
- Apri il tuo Google Sheets
- Dall'URL copia la parte tra `/d/` e `/edit`
- Esempio: `1VAUJNVwxX8OLrkQVJP7IEGrqLIrDjJjrhfr7ABVqtns`

### 2️⃣ **Pubblica come Web App**
- Distribuisci → Nuova distribuzione
- Tipo: **App web**
- Esegui come: **Me**
- Accesso: **Chiunque con il link**

### 3️⃣ **Copia URL di esecuzione**
- Copia l'URL che termina con `/exec`
- Esempio: `https://script.google.com/macros/s/AKfycb.../exec`

### 4️⃣ **Verifica nel frontend**
- L'URL deve essere già presente in `config.js`
- Se diversa, aggiorna `FRONTEND_CONFIG.API_URL`

---

## 🧪 Test rapidi (incolla nel browser)

Sostituisci `YOUR_GAS_URL` con la tua URL `/exec`:

### **🔐 User APIs (existing):**
```
# Test connessione
YOUR_GAS_URL?action=options&token=imbriani_secret_2025

# Test login
YOUR_GAS_URL?action=login&token=imbriani_secret_2025&cf=RSSMRA90A01H501L

# Test disponibilità veicoli
YOUR_GAS_URL?action=disponibilita&token=imbriani_secret_2025

# Test prenotazioni utente
YOUR_GAS_URL?action=recuperaPrenotazioni&token=imbriani_secret_2025&cf=RSSMRA90A01H501L
```

### **🔧 Admin APIs (new v2.0):**
```
# Test tutte le prenotazioni (admin)
YOUR_GAS_URL?action=getAllBookings&token=imbriani_secret_2025

# Test tutti i veicoli (admin)
YOUR_GAS_URL?action=getAllVehicles&token=imbriani_secret_2025

# Test aggiornamento stato (admin)
YOUR_GAS_URL?action=updateBookingStatus&token=imbriani_secret_2025&id=1&status=Confermata
```

**Risposta attesa**: `{"success":true, "message":"...", "data":[...]}`

---

## 📊 Mapping campi

### **📋 Foglio "Risposte del modulo 1" (Prenotazioni):**
| Campo Frontend | Colonna Google Sheets | Descrizione |
|---|---|---|
| ID | ID prenotazione | Numero univoco auto-incrementale |
| DataCreazione | Informazioni cronologiche | Timestamp creazione |
| NomeCompleto | Nome | Nome completo cliente |
| CF | Codice fiscale | Codice fiscale cliente |
| Telefono | Cellulare | Numero di telefono |
| Email | Email | Email cliente |
| DataRitiro | Giorno inizio noleggio | Data ritiro (YYYY-MM-DD) |
| OraRitiro | Ora inizio noleggio | Orario ritiro (HH:MM) |
| DataConsegna | Giorno fine noleggio | Data riconsegna (YYYY-MM-DD) |
| OraConsegna | Ora fine noleggio | Orario riconsegna (HH:MM) |
| Destinazione | Destinazione | Luogo di destinazione |
| Targa | Targa | Targa veicolo assegnato |
| Stato | Stato prenotazione | Da confermare/Confermata/Annullata |

### **🚐 Foglio "Gestione Pulmini" (Veicoli):**
| Campo Frontend | Colonna Google Sheets | Descrizione |
|---|---|---|
| Targa | Targa | Codice targa veicolo |
| Marca | Marca | Marca del veicolo |
| Modello | Modello | Modello del veicolo |
| Posti | Posti | Numero posti (deve essere "9" per pulmini) |
| Disponibile | Stato | "disponibile" per veicoli liberi |
| Note | Note | Note aggiuntive |

---

## 🔥 Admin Dashboard Pro - Nuove Features v2.0

### **📊 Smart Filters**
- **📅 Date Range**: Filtra per periodo (da/a)
- **🔍 Stati**: Dropdown con Da confermare/Confermata/Annullata
- **🚐 Veicoli**: Auto-popolato dalle targhe nel foglio
- **👤 Cliente**: Live search per nome

### **⚡ Bulk Actions**
- **☑️ Select all/none**: Checkbox master per selezione multipla
- **✅ Conferma batch**: Aggiorna multiple prenotazioni a "Confermata"
- **❌ Rifiuta batch**: Aggiorna multiple prenotazioni a "Annullata"
- **📊 Counter dinamico**: Mostra quante prenotazioni sono selezionate

### **📈 Export Excel**
- **📊 Export completo**: Tutte le prenotazioni con 14 colonne
- **🎯 Export filtrato**: Solo prenotazioni che passano i filtri attuali
- **📋 Colonne incluse**: ID, Data, Cliente, CF, Telefono, Email, Date ritiro/consegna, Targa, Stato, Note
- **📅 Filename automatico**: Con timestamp per evitare sovrascritture

### **📊 Analytics & Charts**
- **📊 Utilizzo Pulmini**: Bar chart con Chart.js
- **📈 Stati Prenotazioni**: Doughnut chart con colori per stato
- **📱 Responsive**: Grafici adattivi per mobile
- **🔄 Auto-refresh**: Si aggiornano automaticamente con i dati

---

## 🚨 Troubleshooting

### "Unauthorized"
**Causa**: Token errato  
**Soluzione**: Verifica `AUTH_TOKEN` in GAS = `imbriani_secret_2025`

### "Foglio mancante"
**Causa**: Nome scheda errato  
**Soluzione**: Verifica nomi esatti: `"Risposte del modulo 1"` e `"Gestione Pulmini"`

### "Chart is not defined"
**Causa**: Chart.js ESM build invece di UMD  
**Soluzione**: ✅ **Già risolto** - il frontend usa Chart.js UMD build

### "Nessun dato" in Admin Dashboard
**Causa**: API admin non deployate o SHEET_ID errato  
**Soluzione**: 
1. Verifica che il codice completo sia copiato in Apps Script
2. Fai un nuovo Deploy Web App
3. Testa le API admin con i link sopra

### "Disponibilità vuota"
**Causa**: Nessun veicolo 9 posti disponibile  
**Soluzione**: Nel foglio "Gestione Pulmini" imposta `Posti=9` e `Stato=disponibile`

---

## ✅ Sistema operativo quando

- ✅ Apps Script deployato come Web App con tutte le API (user + admin)
- ✅ SHEET_ID corretto nel codice
- ✅ Fogli "Risposte del modulo 1" e "Gestione Pulmini" esistono
- ✅ Frontend può chiamare GAS via GET senza errori CORS
- ✅ Login riconosce CF dal foglio
- ✅ Prenotazioni si salvano nel foglio
- ✅ **🆕 Admin può vedere tutte le prenotazioni**
- ✅ **🆕 Admin può filtrare per data/stato/targa/cliente**
- ✅ **🆕 Admin può confermare/rifiutare in batch**
- ✅ **🆕 Admin può esportare in Excel**
- ✅ **🆕 Admin vede statistiche e grafici in tempo reale**

🎯 **Il backend v2.0 con Admin Dashboard Pro è pronto!** Segui i step sopra e il sistema sarà completamente operativo.

---

## 📲 Quick Commands

```powershell
# Download BACKEND-SETUP aggiornato
$base = "https://raw.githubusercontent.com/xDren98/imbriani-noleggio/main/"
Invoke-WebRequest -Uri ($base + "BACKEND-SETUP.md?t=" + [DateTime]::UtcNow.Ticks) -OutFile "BACKEND-SETUP.md"
Write-Host "✅ BACKEND-SETUP.md aggiornato"
notepad BACKEND-SETUP.md
```