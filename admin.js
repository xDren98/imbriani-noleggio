// Admin logic
function adminAuthed() { return sessionStorage.getItem('admin') === '1'; }
function setAdminAuth(v) { sessionStorage.setItem('admin', v ? '1' : '0'); }

async function callAPI(params) {
  const url = new URL(window.APP_CONFIG.GAS_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET' });
  return res.json();
}

async function loadPending() {
  const res = await callAPI({ action: 'recuperaPrenotazioni', token: APP_CONFIG.AUTH_TOKEN, cf: 'ALL', stato: 'Da Confermare' });
  const list = document.getElementById('lista-da-confermare');
  list.innerHTML = '';
  if (res.success) {
    (res.data || []).forEach(b => {
      const row = document.createElement('div');
      row.className = 'list-group-item';
      row.innerHTML = `#${b.ID} ${b.CF} ${b.DataRitiro} ${b.OraRitiro} → ${b.DataConsegna} ${b.OraConsegna} • ${b.Targa} • ${b.Stato}
      <div class="mt-2 d-flex gap-2">
        <button class="btn btn-sm btn-success">Conferma</button>
        <button class="btn btn-sm btn-danger">Rifiuta</button>
      </div>`;
      const [btnOk, btnKo] = row.querySelectorAll('button');
      btnOk.onclick = async () => {
        const r = await callAPI({ action: 'modificaStato', token: APP_CONFIG.AUTH_TOKEN, id: b.ID, stato: 'Confermata' });
        if (r.success) loadPending(); else alert(r.message||'Errore');
      };
      btnKo.onclick = async () => {
        const r = await callAPI({ action: 'modificaStato', token: APP_CONFIG.AUTH_TOKEN, id: b.ID, stato: 'Rifiutata' });
        if (r.success) loadPending(); else alert(r.message||'Errore');
      };
      list.appendChild(row);
    });
  }
}

function exportCSVRows(rows) {
  const header = Object.keys(rows[0]||{});
  const csv = [header.join(',')].concat(rows.map(r => header.map(h => (r[h] ?? '')).join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'prenotazioni.csv';
  a.click();
}

function initAdmin() {
  document.getElementById('admin-login').onclick = () => {
    const u = document.getElementById('admin-username').value;
    const p = document.getElementById('admin-password').value;
    if (u === 'admin' && p === 'noleggio2025') { setAdminAuth(true); document.getElementById('admin-area').classList.remove('d-none'); }
    else alert('Credenziali errate');
  };
  document.getElementById('refresh').onclick = loadPending;
  document.getElementById('export-csv').onclick = async () => {
    const res = await callAPI({ action: 'recuperaPrenotazioni', token: APP_CONFIG.AUTH_TOKEN, cf: 'ALL' });
    if (res.success) exportCSVRows(res.data||[]);
  };
}

window.addEventListener('DOMContentLoaded', initAdmin);
