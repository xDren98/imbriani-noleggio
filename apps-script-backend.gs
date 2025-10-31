// ====== CONFIGURAZIONE ======
const SHEET_ID = 'INSERISCI_SHEET_ID';            // ← 🔑 Incolla qui lo Sheet ID
const AUTH_TOKEN = 'imbriani_secret_2025';        // ← mantieni allineato a frontend
const TIMEZONE = 'Europe/Rome';

// Nomi fogli (adattati alla struttura esistente)
const S_PRENOTAZIONI = 'Risposte del modulo 1';   // Foglio principale con tutte le prenotazioni
const S_VEICOLI = 'Gestione Pulmini';             // Foglio veicoli

// ====== UTILS ======
function sheet(name){ return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); }
function nowISO(){ return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"); }
function ok(data, message='Operazione completata'){ return buildResponse(200, { success:true, message, data }); }
function err(message, code=400){ return buildResponse(code, { success:false, message }); }
function buildResponse(code, body){
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
function withCORS(response){
  // Apps Script gestisce CORS automaticamente per ContentService
  return response;
}

// ====== ENTRYPOINT ======
function doGet(e){
  try{
    const q = e.parameter || {};
    if ((q.action||'') === 'options') return withCORS(ok(null, 'OK'));
    if (q.token !== AUTH_TOKEN) return withCORS(err('Unauthorized', 401));

    switch(q.action){
      case 'login':               return withCORS(handleLogin(q));
      case 'creaPrenotazione':    return withCORS(handleCreaPrenotazione(q));
      case 'recuperaPrenotazioni':return withCORS(handleRecuperaPrenotazioni(q));
      case 'disponibilita':       return withCORS(handleDisponibilita(q));
      case 'modificaStato':       return withCORS(handleModificaStato(q));
      default: return withCORS(err('Azione non supportata'));
    }
  } catch(ex){
    return withCORS(err('Errore: ' + ex.toString()));
  }
}

// ====== ACTIONS ======
function handleLogin(q){
  const cf = (q.cf||'').toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cf)) return err('CF non valido');

  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');

  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const idxCF = header.indexOf('Codice fiscale');
  
  // Cerca cliente esistente
  let cliente = null;
  for (const r of data){
    if ((r[idxCF]||'').toString().toUpperCase() === cf){
      // Costruisci oggetto cliente dai dati esistenti
      cliente = {
        CF: cf,
        Nome: r[header.indexOf('Nome')] || '',
        Cognome: '', // Non presente nel foglio attuale
        Email: r[header.indexOf('Email')] || '',
        Cellulare: r[header.indexOf('Cellulare')] || '',
        DataNascita: r[header.indexOf('Data di nascita')] || '',
        LuogoNascita: r[header.indexOf('Luogo di nascita')] || '',
        ComuneResidenza: r[header.indexOf('Comune di residenza')] || '',
        ViaResidenza: r[header.indexOf('Via di residenza')] || '',
        NumeroPatente: r[header.indexOf('Numero di patente')] || '',
        ScadenzaPatente: r[header.indexOf('Scadenza patente')] || ''
      };
      break;
    }
  }

  // Se cliente non trovato, restituisci struttura vuota per nuovo cliente
  if (!cliente) {
    cliente = {
      CF: cf,
      Nome: '', Cognome: '', Email: '', Cellulare: '',
      DataNascita: '', LuogoNascita: '', ComuneResidenza: '', 
      ViaResidenza: '', NumeroPatente: '', ScadenzaPatente: ''
    };
  }

  return ok(cliente);
}

function handleCreaPrenotazione(q){
  const required = ['cf','dataRitiro','oraRitiro','dataConsegna','oraConsegna','targa','destinazione'];
  for (const k of required) if (!q[k]) return err('Parametro mancante: '+k);

  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');

  const data = sh.getDataRange().getValues();
  const header = data.shift();
  
  // Genera nuovo ID prenotazione
  const idxID = header.indexOf('ID prenotazione');
  let maxId = 0;
  for (const r of data){
    const id = parseInt(r[idxID],10);
    if (!isNaN(id) && id > maxId) maxId = id;
  }
  const newId = maxId + 1;

  // Parsing autisti dal frontend
  const drivers = q.drivers ? JSON.parse(decodeURIComponent(q.drivers)) : [];
  const mainDriver = drivers[0] || {};
  const driver2 = drivers[1] || {};
  const driver3 = drivers[2] || {};

  // Prepara riga secondo la struttura del foglio esistente
  const row = new Array(header.length).fill('');
  
  // Mappa i campi dalla richiesta alla struttura del foglio
  header.forEach((colName, i) => {
    switch(colName) {
      case 'Informazioni cronologiche':
        row[i] = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
        break;
      case 'Nome':
        row[i] = mainDriver.Nome || '';
        break;
      case 'Data di nascita':
        row[i] = mainDriver.DataNascita || '';
        break;
      case 'Luogo di nascita':
        row[i] = mainDriver.LuogoNascita || '';
        break;
      case 'Codice fiscale':
        row[i] = (q.cf||'').toUpperCase();
        break;
      case 'Comune di residenza':
        row[i] = mainDriver.ComuneResidenza || '';
        break;
      case 'Via di residenza':
        row[i] = mainDriver.ViaResidenza || '';
        break;
      case 'Civico di residenza':
        row[i] = mainDriver.CivicoResidenza || '';
        break;
      case 'Numero di patente':
        row[i] = mainDriver.NumeroPatente || '';
        break;
      case 'Scadenza patente':
        row[i] = mainDriver.ScadenzaPatente || '';
        break;
      case 'Targa':
        row[i] = q.targa;
        break;
      case 'Ora inizio noleggio':
        row[i] = q.oraRitiro;
        break;
      case 'Ora fine noleggio':
        row[i] = q.oraConsegna;
        break;
      case 'Giorno inizio noleggio':
        row[i] = q.dataRitiro;
        break;
      case 'Giorno fine noleggio':
        row[i] = q.dataConsegna;
        break;
      case 'Destinazione':
        row[i] = q.destinazione;
        break;
      case 'Cellulare':
        row[i] = mainDriver.Cellulare || '';
        break;
      case 'Data contratto':
        row[i] = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
        break;
      case 'Nome Autista 2':
        row[i] = driver2.Nome || '';
        break;
      case 'Data di nascita Autista 2':
        row[i] = driver2.DataNascita || '';
        break;
      case 'Codice fiscale Autista 2':
        row[i] = driver2.CF || '';
        break;
      case 'Numero di patente Autista 2':
        row[i] = driver2.NumeroPatente || '';
        break;
      case 'Scadenza patente Autista 2':
        row[i] = driver2.ScadenzaPatente || '';
        break;
      case 'Nome Autista 3':
        row[i] = driver3.Nome || '';
        break;
      case 'Data di nascita Autista 3':
        row[i] = driver3.DataNascita || '';
        break;
      case 'Codice fiscale Autista 3':
        row[i] = driver3.CF || '';
        break;
      case 'Numero di patente Autista 3':
        row[i] = driver3.NumeroPatente || '';
        break;
      case 'Scadenza patente Autista 3':
        row[i] = driver3.ScadenzaPatente || '';
        break;
      case 'ID prenotazione':
        row[i] = newId;
        break;
      case 'Stato prenotazione':
        row[i] = 'Da Confermare';
        break;
      case 'Email':
        row[i] = mainDriver.Email || '';
        break;
    }
  });

  sh.appendRow(row);
  return ok({ id: newId });
}

function handleRecuperaPrenotazioni(q){
  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');
  
  const all = sh.getDataRange().getValues();
  const header = all.shift();
  
  const idxCF = header.indexOf('Codice fiscale');
  const idxStato = header.indexOf('Stato prenotazione');

  let rows = all.map(r => {
    return {
      ID: r[header.indexOf('ID prenotazione')] || '',
      CF: r[idxCF] || '',
      DataRitiro: r[header.indexOf('Giorno inizio noleggio')] || '',
      OraRitiro: r[header.indexOf('Ora inizio noleggio')] || '',
      DataConsegna: r[header.indexOf('Giorno fine noleggio')] || '',
      OraConsegna: r[header.indexOf('Ora fine noleggio')] || '',
      Targa: r[header.indexOf('Targa')] || '',
      Destinazione: r[header.indexOf('Destinazione')] || '',
      Stato: r[idxStato] || 'Da Confermare',
      DataCreazione: r[header.indexOf('Data contratto')] || '',
      Nome: r[header.indexOf('Nome')] || '',
      Cellulare: r[header.indexOf('Cellulare')] || '',
      Email: r[header.indexOf('Email')] || ''
    };
  });

  // Filtro CF (ALL = tutte le prenotazioni per admin)
  if ((q.cf||'').toUpperCase() !== 'ALL'){
    const cf = (q.cf||'').toUpperCase();
    rows = rows.filter(r => (r.CF||'').toUpperCase() === cf);
  }

  // Filtro stato opzionale
  if (q.stato){
    rows = rows.filter(r => (r.Stato||'') === q.stato);
  }

  return ok(rows);
}

function handleDisponibilita(q){
  const sh = sheet(S_VEICOLI);
  if (!sh) return err('Foglio veicoli mancante');
  
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  
  const rows = data.map(r => {
    const stato = (r[header.indexOf('Stato')] || '').toString().toLowerCase();
    return {
      Targa: r[header.indexOf('Targa')] || '',
      Marca: r[header.indexOf('Marca')] || '',
      Modello: r[header.indexOf('Modello')] || '',
      Posti: r[header.indexOf('Posti')] || '',
      Disponibile: stato === 'disponibile' || stato === 'attivo',
      Note: r[header.indexOf('Note')] || ''
    };
  });

  // Filtra solo pulmini 9 posti disponibili
  const available = rows.filter(v => 
    String(v.Posti) === '9' && v.Disponibile === true
  );
  
  return ok(available);
}

function handleModificaStato(q){
  const id = parseInt(q.id, 10);
  const nuovoStato = q.stato || '';
  if (!id || !nuovoStato) return err('Parametri mancanti: id e stato');

  const sh = sheet(S_PRENOTAZIONI);
  if (!sh) return err('Foglio prenotazioni mancante');
  
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const idxID = header.indexOf('ID prenotazione');
  const idxStato = header.indexOf('Stato prenotazione');

  for (let i = 0; i < data.length; i++){
    const currentId = parseInt(data[i][idxID], 10);
    if (currentId === id){
      // Aggiorna lo stato (riga i+2 perché abbiamo tolto header e gli indici partono da 1)
      sh.getRange(i + 2, idxStato + 1).setValue(nuovoStato);
      return ok({ id: id, stato: nuovoStato });
    }
  }
  
  return err('Prenotazione con ID ' + id + ' non trovata');
}