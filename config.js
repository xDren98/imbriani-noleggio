/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - config.js v1.1 - ADATTATO PER GOOGLE SHEETS ESISTENTE
   Configurazione Centralizzata Frontend
   Aggiornato: 31 Ottobre 2025
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// =====================
// API CONFIGURATION
// =====================
const FRONTEND_CONFIG = {
  // ✅ API Deployment (GIA' CONFIGURATO)
  API_URL: 'https://script.google.com/macros/s/AKfycbx8vOsfdliS4e5odoRMkvCwaWY7SowSkgtW0zTuvqDIu4R99sUEixlLSW7Y9MyvNWk/exec',
  
  // Auth Token - MANTENUTO ORIGINALE
  TOKEN: 'imbriani_secret_2025',
  
  // API Endpoints mapping - ADATTATI PER GOOGLE SHEETS ESISTENTE
  endpoints: {
    login: '?action=login',
    datiCliente: '?action=login', // Stesso endpoint per dati cliente
    recuperaPrenotazioni: '?action=recuperaPrenotazioni',
    disponibilita: '?action=disponibilita',
    aggiornaProfilo: '?action=aggiornaProfilo', // Da implementare se necessario
    manageBooking: '?action=creaPrenotazione', // Per nuove prenotazioni
    generatePDF: '?action=generatePDF', // Da implementare se necessario
    adminPrenotazioni: '?action=recuperaPrenotazioni&cf=ALL',
    modificaStato: '?action=modificaStato',
  },
  
  // Timeouts 
  timeouts: {
    fetch: 15000,
    retry: 3
  },
  
  // UI Config
  ui: {
    animationDuration: 300,
    toastDuration: 5000,
    loadingDelay: 200
  },
  
  // Validation Rules
  validation: {
    CF_LENGTH: 16,
    MAX_AUTISTI: 3,
    MIN_AUTISTI: 1,
    ORARI_VALIDI: ['08:00', '12:00', '16:00', '20:00']
  },
  
  // Stati Prenotazione - ADATTATI PER GOOGLE SHEETS
  stati: {
    DA_CONFERMARE: 'Da Confermare',
    CONFERMATA: 'Confermata', 
    RIFIUTATA: 'Rifiutata',
    ANNULLATA: 'Annullata'
  },
  
  // Emoji per stati
  statiEmoji: {
    'Da Confermare': '⏳',
    'Confermata': '✅',
    'Rifiutata': '❌',
    'Annullata': '🚫'
  },
  
  // LocalStorage Keys
  storage: {
    CF: 'imbriani_cf',
    USER_DATA: 'imbriani_user',
    BOOKING_DRAFT: 'imbriani_booking_draft',
    LAST_LOGIN: 'imbriani_last_login'
  },
  
  // Debug Mode
  DEBUG: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// =====================
// GOOGLE SHEETS MAPPING
// =====================
const SHEETS_CONFIG = {
  // Nomi fogli come nella struttura esistente
  FOGLI: {
    PRENOTAZIONI: 'Risposte del modulo 1',
    VEICOLI: 'Gestione Pulmini'
  },
  
  // Mapping campi per "Risposte del modulo 1"
  CAMPI_PRENOTAZIONI: {
    TIMESTAMP: 'Informazioni cronologiche',
    NOME: 'Nome',
    DATA_NASCITA: 'Data di nascita',
    LUOGO_NASCITA: 'Luogo di nascita', 
    CF: 'Codice fiscale',
    COMUNE_RESIDENZA: 'Comune di residenza',
    VIA_RESIDENZA: 'Via di residenza',
    CIVICO_RESIDENZA: 'Civico di residenza',
    NUMERO_PATENTE: 'Numero di patente',
    INIZIO_PATENTE: 'Data inizio validità patente',
    SCADENZA_PATENTE: 'Scadenza patente',
    TARGA: 'Targa',
    ORA_INIZIO: 'Ora inizio noleggio',
    ORA_FINE: 'Ora fine noleggio', 
    GIORNO_INIZIO: 'Giorno inizio noleggio',
    GIORNO_FINE: 'Giorno fine noleggio',
    DESTINAZIONE: 'Destinazione',
    CELLULARE: 'Cellulare',
    DATA_CONTRATTO: 'Data contratto',
    // Autisti aggiuntivi
    NOME_AUTISTA_2: 'Nome Autista 2',
    DATA_NASCITA_AUTISTA_2: 'Data di nascita Autista 2',
    LUOGO_NASCITA_AUTISTA_2: 'Luogo di nascita Autista 2',
    CF_AUTISTA_2: 'Codice fiscale Autista 2',
    PATENTE_AUTISTA_2: 'Numero di patente Autista 2',
    SCADENZA_PATENTE_AUTISTA_2: 'Scadenza patente Autista 2',
    NOME_AUTISTA_3: 'Nome Autista 3',
    DATA_NASCITA_AUTISTA_3: 'Data di nascita Autista 3',
    LUOGO_NASCITA_AUTISTA_3: 'Luogo di nascita Autista 3', 
    CF_AUTISTA_3: 'Codice fiscale Autista 3',
    PATENTE_AUTISTA_3: 'Numero di patente Autista 3',
    SCADENZA_PATENTE_AUTISTA_3: 'Scadenza patente Autista 3',
    // Gestione
    ID_PRENOTAZIONE: 'ID prenotazione',
    STATO_PRENOTAZIONE: 'Stato prenotazione',
    IMPORTO_PREVENTIVO: 'Importo preventivo',
    EMAIL: 'Email'
  },
  
  // Mapping campi per "Gestione Pulmini"
  CAMPI_VEICOLI: {
    TARGA: 'Targa',
    MARCA: 'Marca', 
    MODELLO: 'Modello',
    POSTI: 'Posti',
    STATO: 'Stato',
    INIZIO_MANUTENZIONE: 'Data Inizio Manutenzione',
    FINE_MANUTENZIONE: 'Data Fine Manutenzione',
    NOTE: 'Note'
  }
};

// =====================
// GLOBAL HELPERS
// =====================
window.FRONTEND_CONFIG = FRONTEND_CONFIG;
window.SHEETS_CONFIG = SHEETS_CONFIG;

// Debug helper
if (FRONTEND_CONFIG.DEBUG) {
  console.log('%c🔧 CONFIG DEBUG MODE ATTIVO', 'color: #ff6b35; font-weight: bold;');
  console.log('API URL:', FRONTEND_CONFIG.API_URL);
  console.log('Sheets Config:', SHEETS_CONFIG);
}