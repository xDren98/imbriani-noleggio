# 🏠 Test in Locale - Guida Rapida

## 🚀 Setup locale (⏱️ 2 minuti)

### **Prerequisiti:**
- Node.js installato (qualsiasi versione recente)
- Git installato

### **Step 1: Clone e setup**
```bash
# Clone del repository
git clone https://github.com/xDren98/imbriani-noleggio.git
cd imbriani-noleggio

# Installa dipendenze
npm install

# Avvia server locale
npm start
```

### **Step 2: Apri il browser**
🌐 **Vai su**: `http://localhost:3000`

---

## ✅ **Test funzionalità principali:**

### **1. Test Login Cliente** 🔐
- Inserisci un CF dal tuo Google Sheets (16 caratteri maiuscoli)
- **Esempio**: Se hai un cliente con CF `RSSMRA90A01H501L`
- Il sistema dovrebbe riconoscerlo e mostrare l'area personale

### **2. Test Nuova Prenotazione** 📝
**Tab "Nuova prenotazione":**
- **Step 1**: Scegli date future + orari (8:00/12:00/16:00/20:00) + destinazione
- **Step 2**: Dovrebbero apparire i pulmini 9 posti dal tuo foglio "Gestione Pulmini"
- **Step 3**: Aggiungi almeno 1 autista (obbligatorio)
- **Step 4**: Conferma → dovrebbe salvare nel foglio "Risposte del modulo 1"

### **3. Test Area Personale** 👤
**Tab "Prenotazioni":**
- Dovrebbero apparire le prenotazioni esistenti dal tuo Google Sheets
- Stati: ✓ Confermata / ⏳ Da Confermare / ❌ Annullata

**Tab "Dati anagrafici":**
- Mostra i dati del cliente dal foglio

**Tab "Patente":**
- Info patente + badge scadenza

### **4. Test Admin Panel** ⚡
**Vai su**: `http://localhost:3000/admin.html`
- **Login**: Username `admin` / Password `noleggio2025`
- **Lista**: Dovrebbero apparire prenotazioni "Da Confermare"
- **Azioni**: Testa "Conferma" e "Rifiuta"
- **Export**: Prova il download CSV

---

## 🔧 **Troubleshooting locale:**

### **❌ Errore "CORS blocked"**
**Causa**: Apps Script non accessibile  
**Soluzione**: Verifica che l'URL Apps Script sia corretto in `config.js`

### **❌ "Cannot connect to backend"**
**Causa**: Apps Script non deployato correttamente  
**Soluzione**:
1. Vai su [script.google.com](https://script.google.com)
2. Apri il progetto "imbriani-noleggio-backend"
3. Verifica che sia deployato come "App web"
4. Accesso: "Chiunque con il link"

### **❌ "CF non trovato"**
**Causa**: CF non esiste nel Google Sheets  
**Soluzione**: Usa un CF esistente dal tuo foglio "Risposte del modulo 1"

### **❌ "Nessun veicolo disponibile"**
**Causa**: Foglio "Gestione Pulmini" vuoto o stati errati  
**Soluzione**: 
- Aggiungi almeno un pulmino 9 posti
- Imposta "Stato" = "disponibile" o "attivo"

### **❌ "Prenotazione non si salva"**
**Causa**: Sheet ID errato in Apps Script  
**Soluzione**: 
1. Copia lo Sheet ID dal tuo Google Sheets (URL tra `/d/` e `/edit`)
2. Incollalo nella costante `SHEET_ID` in Apps Script
3. Redeploy l'Apps Script

---

## 🎯 **Test completo end-to-end:**

### **Scenario:** Nuova prenotazione cliente
1. **Login** con CF esistente ✅
2. **Nuova prenotazione** → compila wizard completo ✅
3. **Conferma** → verifica che appaia in "Prenotazioni" ✅
4. **Admin** → approva la prenotazione ✅
5. **Cliente** → ricarica e verifica stato "Confermata" ✅

### **File da controllare:**
- `config.js` - URL Apps Script corretto
- `apps-script-backend.gs` - Sheet ID corretto
- Google Sheets - Fogli "Risposte del modulo 1" e "Gestione Pulmini" esistono

---

## 🚀 **Quando il test locale funziona:**

✅ **Deploy su Vercel** → Il sistema funzionerà identicamente online  
✅ **Condividi link** → I clienti possono prenotare  
✅ **Gestisci prenotazioni** → Tutto tramite admin panel  

**Il test locale garantisce che tutto funzioni perfettamente prima del deploy!** 🎉