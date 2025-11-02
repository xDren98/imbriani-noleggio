# 🎯 IMBRIANI NOLEGGIO v6.0.0-RESTORE
## 🔥 GOLDEN MASTER - Versione Pre-Restyling Funzionante

**Data Golden Commit**: 01 Nov 2025, 19:31:15  
**SHA Originale**: 68c89caca35759529977da65cf86536c226272de  
**Commit**: "fix: Performance CSS - Fixed chart heights + faster loading animations"

---

## ✨ FUNZIONALITÀ INCLUSE

### 🌐 Frontend Cliente v6.0.0
- **Dual Homepage**: Sezioni "Già Cliente" e "Nuovo Cliente" sempre visibili
- **Wizard a 5 Step**: Date → Pulmino → Preventivo → Autisti → Conferma
- **Step Preventivo Obbligatorio**: Phone/WhatsApp con rate limiting
- **Auto-Fill**: Primo autista precompilato con dati ultima prenotazione
- **Voice Input**: Registrazione vocale per destinazione
- **Contrast Mode**: Toggle accessibilità
- **Auto-Save**: Salvataggio automatico bozza ogni 2 secondi
- **Mobile Swipe**: Navigazione touch per mobile
- **Tabs System**: Prenotazioni/Nuovo/Profilo
- **Breadcrumb Navigation**: Click diretto su step
- **ID Prenotazioni**: Formato BOOK-YYYY-XXX

### 🔧 Admin Dashboard Pro
- **Filtri Avanzati**: Data, Stato, Targa, Cliente
- **Bulk Actions**: Conferma/Annulla multiple
- **Export Excel**: SheetJS con prenotazioni filtrate
- **Grafici Chart.js**: Utilizzo pulmini e stati prenotazioni
- **UI Moderna**: Tema antracite/azzurro professionale
- **Real-time Stats**: Contatori dinamici

---

## 🚀 COMANDO DOWNLOAD RAPIDO

```powershell
# SCARICA LA VERSIONE FUNZIONANTE COMPLETA
$repo = "https://raw.githubusercontent.com/xDren98/imbriani-noleggio/v6.0.0-restore/"
$files = @(
  "index.html","scripts.js","shared-utils.js","styles.css","config.js",
  "admin.html","admin-scripts.js","admin-styles.css","design-system.css"
)

Write-Host "⬇️ Scarico versione funzionante..." -ForegroundColor Cyan
foreach ($f in $files) {
  Invoke-WebRequest -Uri ($repo + $f) -OutFile $f -UseBasicParsing
  Write-Host "✅ $f" -ForegroundColor Green
}
Write-Host "🎉 Pronto! Apri index.html e admin.html come file." -ForegroundColor Yellow
```

---

## ⚠️ NOTE IMPORTANTI

### 🌐 CORS e Testing
- **Test Locale**: Apri `index.html` e `admin.html` come FILE (doppio click), NON da localhost
- **Motivo**: Google Apps Script blocca CORS da localhost:3000
- **Soluzione Dev**: Se serve localhost, aggiungi header CORS in Apps Script

### 🤖 Auto-Fill
- Funziona SE il login Apps Script restituisce `ultimoAutista` nel JSON
- Verifica: Console → `localStorage.getItem('user_data')` deve contenere `ultimoAutista`
- Se manca: Aggiorna Apps Script per includere dati ultima prenotazione

### 📊 Dashboard Admin
- La tabella si popola con API: `getAllBookings`, `getAllVehicles`, `updateBookingStatus`
- Se vuota: Esponi queste action in Apps Script o usa gli endpoint esistenti
- Grafici Chart.js: Si popolano con i dati delle API

---

## 🎯 CARATTERISTICHE CHIAVE

**Frontend**:
- Login con CF → Area personale con tabs
- Nuovo cliente → CTA diretta al wizard
- Auto-fill date intelligente (domani/dopodomani)
- Validazione CF real-time
- Toast notifications
- Progress tracking

**Admin**:
- Dashboard responsive
- Filtri real-time
- Export Excel completo
- Bulk operations
- Analytics visive

**Compatibilità**:
- Bootstrap-free (CSS custom)
- Mobile-responsive
- Accessibility features
- Cross-browser compatible

---

🎉 **Questa è la versione ESATTA che funzionava prima del restyling!**