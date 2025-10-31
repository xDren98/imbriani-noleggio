# 📝 Backend Google Apps Script - Guida rapida

## Setup completato ✅

Il backend è stato adattato alla tua struttura Google Sheets esistente:

### Fogli supportati:
- **"Risposte del modulo 1"** - Contiene tutte le prenotazioni e dati clienti
- **"Gestione Pulmini"** - Gestione flotta veicoli

### Struttura mappata:

#### Prenotazioni (Risposte del modulo 1):
- ✅ Codice fiscale → CF cliente
- ✅ Nome, Data nascita, Luogo nascita → Dati principali
- ✅ Giorno/Ora inizio/fine noleggio → Date prenotazione
- ✅ Targa, Destinazione → Dettagli viaggio
- ✅ Autista 2/3 → Autisti aggiuntivi
- ✅ ID prenotazione, Stato prenotazione → Gestione

#### Veicoli (Gestione Pulmini):
- ✅ Targa, Marca, Modello, Posti
- ✅ Stato → Disponibile/Non disponibile
- ✅ Filtro automatico: solo 9 posti + stato "disponibile"

## 🚀 Prossimi step:

### 1. Copia il codice Apps Script
Il file `apps-script-backend.gs` contiene tutto il codice necessario.

### 2. Crea nuovo progetto Apps Script
1. Vai su [script.google.com](https://script.google.com)
2. Nuovo progetto → "imbriani-noleggio-backend"
3. Incolla il codice da `apps-script-backend.gs`
4. **IMPORTANTE**: Sostituisci `INSERISCI_SHEET_ID` con l'ID del tuo foglio

### 3. Deploy come Web App
1. Distribuisci → Nuova distribuzione
2. Tipo: App web
3. Esegui come: Me
4. Accesso: Chiunque con il link
5. Copia URL di esecuzione (termina con `/exec`)

### 4. Collega frontend
Sostituisci in `config.js`:
```javascript
window.APP_CONFIG = {
  GAS_URL: 'LA_TUA_URL_APPS_SCRIPT_QUI',
  AUTH_TOKEN: 'imbriani_secret_2025'
};
```

## 📋 API Endpoints supportati:

- **login**: Recupera/crea cliente per CF
- **creaPrenotazione**: Salva nuova prenotazione
- **recuperaPrenotazioni**: Lista prenotazioni cliente/admin
- **disponibilita**: Veicoli 9 posti disponibili
- **modificaStato**: Approva/rifiuta prenotazioni (admin)

## 🔧 Note tecniche:

- **Compatibilità**: Adattato alla tua struttura esistente
- **Autisti multipli**: Gestisce fino a 3 autisti per prenotazione
- **Stati**: "Da Confermare" → "Confermata"/"Rifiutata"
- **Sicurezza**: Token AUTH_TOKEN per tutte le chiamate
- **CORS**: Gestito automaticamente con GET requests

## 🎯 Cosa ti serve:

1. **Sheet ID**: L'ID del tuo Google Sheets (tra `/d/` e `/edit` nell'URL)
2. **Apps Script URL**: L'URL `/exec` dopo il deploy

Con questi due valori il sistema sarà operativo!