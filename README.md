# 📦 Imbriani Noleggio (Frontend statico + Google Apps Script)

Questo repository contiene il frontend statico per il sistema di prenotazioni Imbriani Noleggio. Tutte le chiamate avvengono direttamente verso Google Apps Script via GET per evitare CORS e server intermedi.

## 🔗 Backend (GAS)
- URL: https://script.google.com/macros/s/AKfycbx8vOsfdliS4e5odoRMkvCwaWY7SowSkgtW0zTuvqDIu4R99sUEixlLSW7Y9MyvNWk/exec
- TOKEN: imbriani_secret_2025
- Azioni supportate:
  - action=login
  - action=recuperaPrenotazioni
  - action=disponibilita
  - action=creaPrenotazione
  - action=modificaStato

## 📁 Struttura
- index.html — App cliente (login, area personale, wizard 4 step)
- admin.html — Pannello admin
- config.js — Configurazione API + mapping Google Sheets
- scripts.js — Logica cliente
- shared-utils.js — Utility condivise (fetch con retry, helpers)
- styles.css — Stili
- admin.js — Logica admin

## 🏠 Test locale
- Apri direttamente index.html nel browser
- Oppure esegui un server statico:
```bash
npx serve .
# oppure
python -m http.server 3000
```

## 🌐 Deploy consigliato (senza server)
- GitHub Pages: Settings → Pages → Deploy from branch → main → root
- Netlify: Drag & Drop della cartella

## 📝 Note
- Le chiamate API sono GET con token in querystring
- I fogli Google supportati sono:
  - "Risposte del modulo 1"
  - "Gestione Pulmini"
- Il mapping campi è definito in config.js (SHEETS_CONFIG)
