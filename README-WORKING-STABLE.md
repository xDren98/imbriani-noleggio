# 🎯 WORKING-STABLE BRANCH

## Backend Actions Supportate ✅

### User API
- `action=login` - Login con CF
- `action=recuperaPrenotazioni` - Lista prenotazioni utente  
- `action=disponibilita` - Pulmini disponibili
- `action=creaPrenotazione` - Crea nuova prenotazione
- `action=modificaStato` - Modifica stato prenotazione

### Admin API
- `action=getAllBookings` - Tutte le prenotazioni (admin)
- `action=getAllVehicles` - Tutti i veicoli (admin)
- `action=updateBookingStatus` - Aggiorna stato (admin)

## Funzionalità Frontend 🚀
- Dual Homepage (Già Cliente / Nuovo Cliente)
- Login con CF ✅
- Tab: Prenotazioni / Nuovo / Profilo ✅
- Wizard 5 step: Date → Pulmini → Preventivo → Autisti → Conferma ✅
- Auto-fill date per nuovi clienti ✅
- Voice input destinazione ✅
- Preventivo obbligatorio (WhatsApp/Telefono) ✅
- Toast notifications ✅
- Loading overlay ✅

## Test Rapido 🧪
1. Apri `index.html` come file (doppio click)
2. Login con CF 16 caratteri
3. Prova tutti i tab
4. Testa wizard completo

## Backup Comando 💾
```powershell
# Backup versione corrente
$date = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Name "backup-$date" -Force
Get-ChildItem -File *.html,*.js,*.css | Copy-Item -Destination "backup-$date"

# Download versione working-stable
$repo = "https://raw.githubusercontent.com/xDren98/imbriani-noleggio/working-stable/"
$files = @("index.html","scripts.js","shared-utils.js","styles.css","config.js")
foreach ($f in $files) {
  Invoke-WebRequest -Uri ($repo + $f) -OutFile $f -UseBasicParsing
}
```