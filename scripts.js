/* ═══════════════════════════════════════════════════════════════════════════
   IMBRIANI NOLEGGIO - scripts.js v5.4.1 (auto-fill autista)
   - Auto-compila Autista 1 da ultima prenotazione (backend login)
   - GET-only verso Google Apps Script
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

let clienteCorrente = null;
let prenotazioniUtente = [];
let booking_data = {};

// ===== Helpers =====
const qsId = (id) => document.getElementById(id);

// Toast e Loader da shared-utils.js

// ===== LOGIN =====
async function handleLogin(e){
  e?.preventDefault?.();
  const cf = (qsId('cf-input')?.value || '').toUpperCase().trim();
  if (!isValidCF(cf)) { showToast('CF non valido (16 caratteri)', 'danger'); return; }

  showLoader(true);
  try {
    const res = await callAPI('login', { cf });
    if (res.success){
      clienteCorrente = res.data || {};
      localStorage.setItem('imbriani_cf', cf);
      // Mostra dashboard
      qsId('login-section')?.classList.add('hidden');
      qsId('user-dashboard')?.classList.remove('hidden');
      // Prepara wizard
      resetWizard();
      // Carica prenotazioni e disponibilità
      await Promise.all([loadUserBookings(), loadAvailableVehicles()]);
    } else {
      showToast(res.message||'Errore login', 'danger');
    }
  } catch(err){
    console.error(err); showToast('Errore di rete', 'danger');
  } finally { showLoader(false); }
}

// ===== PRENOTAZIONI =====
async function loadUserBookings(){
  if (!clienteCorrente?.CF) return;
  const res = await callAPI('recuperaPrenotazioni', { cf: clienteCorrente.CF });
  if (res.success) prenotazioniUtente = res.data || [];
}

// ===== WIZARD =====
function resetWizard(){
  booking_data = {};
  // Pulisci contenitore autisti
  const cont = qsId('autisti-container');
  if (cont) cont.innerHTML = '';
  // Aggiungi Autista 1 con auto-fill
  addDriver(true);
}

function addDriver(isFirst=false){
  const cont = qsId('autisti-container');
  if (!cont) return;

  const pre = isFirst && clienteCorrente?.ultimoAutista ? clienteCorrente.ultimoAutista : null;

  const div = document.createElement('div');
  div.className = 'driver-form';
  div.innerHTML = `
    <div class="driver-header">
      <h5>Autista ${cont.children.length + 1} ${isFirst ? '(Intestatario)' : ''}</h5>
      ${!isFirst ? '<button type="button" class="btn btn-sm btn-outline" onclick="removeDriver(this)">❌ Rimuovi</button>' : ''}
    </div>
    <div class="driver-fields">
      <div class="form-row">
        <div class="form-group"><input type="text" class="driver-nome" placeholder="Nome" value="${pre?.Nome||''}" required></div>
        <div class="form-group"><input type="text" class="driver-cognome" placeholder="Cognome" value="" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><input type="text" class="driver-cf" placeholder="Codice Fiscale" maxlength="16" value="${pre?.CF||clienteCorrente?.CF||''}" required></div>
        <div class="form-group"><input type="date" class="driver-data-nascita" placeholder="Data di nascita" value="${pre?.DataNascita||''}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><input type="text" class="driver-luogo-nascita" placeholder="Luogo di nascita" value="${pre?.LuogoNascita||''}"></div>
        <div class="form-group"><input type="text" class="driver-comune" placeholder="Comune residenza" value="${pre?.ComuneResidenza||''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><input type="text" class="driver-indirizzo" placeholder="Via e civico" value="${pre ? ((pre.ViaResidenza||'') + ' ' + (pre.CivicoResidenza||'')) : ''}"></div>
        <div class="form-group"><input type="text" class="driver-patente" placeholder="Numero patente" value="${pre?.NumeroPatente||''}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><input type="date" class="driver-inizio-patente" placeholder="Inizio validità patente" value="${pre?.InizioPatente||''}"></div>
        <div class="form-group"><input type="date" class="driver-scadenza" placeholder="Scadenza patente" value="${pre?.ScadenzaPatente||''}" required></div>
      </div>
    </div>`;
  cont.appendChild(div);
}

function removeDriver(btn){ btn.closest('.driver-form').remove(); }

function collectDriverData(){
  const list = [];
  document.querySelectorAll('.driver-form').forEach(f => {
    const d = {
      Nome: f.querySelector('.driver-nome').value,
      Cognome: f.querySelector('.driver-cognome').value,
      CF: f.querySelector('.driver-cf').value.toUpperCase(),
      DataNascita: f.querySelector('.driver-data-nascita').value,
      LuogoNascita: f.querySelector('.driver-luogo-nascita')?.value||'',
      ComuneResidenza: f.querySelector('.driver-comune')?.value||'',
      ViaResidenza: f.querySelector('.driver-indirizzo')?.value||'',
      CivicoResidenza: '',
      NumeroPatente: f.querySelector('.driver-patente').value,
      InizioPatente: f.querySelector('.driver-inizio-patente')?.value||'',
      ScadenzaPatente: f.querySelector('.driver-scadenza').value,
      Cellulare: clienteCorrente?.Cellulare||'',
      Email: clienteCorrente?.Email||''
    };
    if (d.Nome && d.CF && d.NumeroPatente) list.push(d);
  });
  return list;
}

async function submitBooking(){
  const drivers = collectDriverData();
  if (!drivers.length){ showToast('Aggiungi almeno un autista', 'warning'); return; }
  const payload = { /* ... altri campi step 1-2 ... */ drivers: encodeURIComponent(JSON.stringify(drivers)), cf: clienteCorrente?.CF };
  showLoader(true);
  try{
    const res = await callAPI('creaPrenotazione', payload);
    if (res.success){ showToast('Prenotazione creata', 'success'); }
    else showToast(res.message||'Errore creazione', 'danger');
  }catch(e){ showToast('Errore rete', 'danger'); }
  finally{ showLoader(false); }
}

// ===== INIT BINDINGS =====
window.addEventListener('DOMContentLoaded', () => {
  const form = qsId('login-form'); if (form) form.addEventListener('submit', handleLogin);
  const addBtn = document.getElementById('add-autista'); if (addBtn) addBtn.addEventListener('click', ()=>addDriver(false));
});
