// Ranking Universidades LatAm+España — dashboard estático, vanilla + Chart.js + Leaflet.
const CFG = window.RANK_CONFIG || {};
const PRIMARY = '#2b4a9e', ORO = '#c99a2e';
const fmtN = v => (v == null ? '—' : Math.round(v).toLocaleString('es-PE'));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
const grid = () => isDark() ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
const FLAG = { ES: '🇪🇸', BR: '🇧🇷', MX: '🇲🇽', AR: '🇦🇷', CO: '🇨🇴', CL: '🇨🇱', PE: '🇵🇪', EC: '🇪🇨', VE: '🇻🇪', CU: '🇨🇺', BO: '🇧🇴', PY: '🇵🇾', UY: '🇺🇾', CR: '🇨🇷', PA: '🇵🇦', GT: '🇬🇹', HN: '🇭🇳', SV: '🇸🇻', NI: '🇳🇮', DO: '🇩🇴', PR: '🇵🇷' };
const PAIS = { ES: 'España', BR: 'Brasil', MX: 'México', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Perú', EC: 'Ecuador', VE: 'Venezuela', CU: 'Cuba', BO: 'Bolivia', PY: 'Paraguay', UY: 'Uruguay', CR: 'Costa Rica', PA: 'Panamá', GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', DO: 'Rep. Dominicana', PR: 'Puerto Rico' };
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

function toggleTheme() {
  const d = isDark();
  document.documentElement.setAttribute('data-theme', d ? 'light' : 'dark');
  localStorage.setItem('rank_theme', d ? 'light' : 'dark');
  document.getElementById('tglBtn').textContent = d ? '🌙 Tema' : '☀️ Tema';
  Object.values(Chart.instances).forEach(c => c.destroy());
  render();
}
(function () { const t = localStorage.getItem('rank_theme'); if (t) document.documentElement.setAttribute('data-theme', t); if (isDark()) document.getElementById('tglBtn').textContent = '☀️ Tema'; })();

const navA = [...document.querySelectorAll('nav.links a')];
window.addEventListener('scroll', () => { let cur = ''; document.querySelectorAll('section').forEach(s => { if (window.scrollY >= s.offsetTop - 120) cur = s.id; }); navA.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur)); });
navA.forEach(a => a.addEventListener('click', () => document.getElementById('nav').classList.remove('show')));

let U = [], sortK = 'rank', sortAsc = true, mapObj = null;

async function boot() {
  try { const r = await fetch('data/universidades.json?v=' + Date.now()); const d = await r.json(); const all = d.unis || []; window._meta = d.meta || {}; window._centros = all.filter(x => x.tipo && x.tipo !== 'universidad'); U = all.filter(x => !x.tipo || x.tipo === 'universidad'); } catch { U = []; }
  // poblar filtro país y comparador
  const paises = [...new Set(U.map(u => u.cc))].sort((a, b) => (PAIS[a] || a).localeCompare(PAIS[b] || b));
  document.getElementById('fPais').insertAdjacentHTML('beforeend', paises.map(c => `<option value="${c}">${FLAG[c] || ''} ${esc(PAIS[c] || c)}</option>`).join(''));
  const opts = U.slice(0, 200).map(u => `<option value="${esc(u.oa)}">${esc(u.name)}</option>`).join('');
  document.getElementById('cmpA').innerHTML = opts; document.getElementById('cmpB').innerHTML = opts;
  if (U[0]) document.getElementById('cmpA').value = U[0].oa;
  if (U[1]) document.getElementById('cmpB').value = U[1].oa;
  // listeners
  document.getElementById('q').addEventListener('input', drawRank);
  document.getElementById('fReg').addEventListener('change', drawRank);
  document.getElementById('fPais').addEventListener('change', drawRank);
  document.querySelectorAll('#tRank th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; sortAsc = sortK === k ? !sortAsc : (k === 'name' || k === 'cc'); sortK = k; drawRank(); }));
  document.getElementById('cmpA').addEventListener('change', drawCmp);
  document.getElementById('cmpB').addEventListener('change', drawCmp);
  render();
}
function render() { renderKpis(); drawRank(); drawPaises(); drawMap(); drawCmp(); }

function renderKpis() {
  const el = document.getElementById('kpis'); if (!el || !U.length) return;
  const top = U[0], topLat = U.find(u => u.region === 'Latinoamérica');
  const totW = U.reduce((s, u) => s + (u.works || 0), 0);
  const nPais = new Set(U.map(u => u.cc)).size;
  const k = [
    ['Universidades', fmtN(U.length), 'con producción real'],
    ['Países', nPais, 'Latinoamérica + España'],
    ['#1 de la región', esc((top.name || '').slice(0, 22)), (FLAG[top.cc] || '') + ' índice ' + top.score],
    ['#1 de Latinoamérica', topLat ? esc(topLat.name.slice(0, 22)) : '—', topLat ? (FLAG[topLat.cc] || '') + ' puesto #' + topLat.rank : ''],
    ['Publicaciones totales', fmtN(totW), 'OpenAlex, acumulado'],
  ];
  el.innerHTML = k.map(x => `<div class="kpi"><div class="v">${x[1]}</div><div class="l">${x[0]}</div><div class="s">${x[2] || ''}</div></div>`).join('');
}

function filtered() {
  const q = (document.getElementById('q').value || '').trim().toLowerCase();
  const reg = document.getElementById('fReg').value, pais = document.getElementById('fPais').value;
  let r = U.filter(u => (!reg || u.region === reg) && (!pais || u.cc === pais) &&
    (!q || (`${u.name} ${PAIS[u.cc] || ''}`).toLowerCase().includes(q)));
  r = [...r].sort((a, b) => {
    let va = a[sortK], vb = b[sortK];
    if (sortK === 'name' || sortK === 'cc') { va = (va || '').toString(); vb = (vb || '').toString(); return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va); }
    va = va ?? -1; vb = vb ?? -1; return sortAsc ? va - vb : vb - va;
  });
  return r;
}
function drawRank() {
  const rows = filtered();
  const tb = document.querySelector('#tRank tbody');
  tb.innerHTML = rows.slice(0, 300).map(u => `<tr>
    <td class="rk">${u.rank}</td>
    <td>${esc(u.name)}</td>
    <td><span class="flag">${FLAG[u.cc] || ''}</span>${esc(PAIS[u.cc] || u.cc)}</td>
    <td class="n"><strong>${u.score}</strong></td>
    <td class="n">${fmtN(u.works)}</td>
    <td class="n">${fmtN(u.cited)}</td>
    <td class="n">${u.h ?? '—'}</td>
    <td class="n">${u.cpp ?? '—'}</td>
    <td class="n">${u.q1_pct != null ? u.q1_pct + '%' : '<span class="pill">…</span>'}</td>
  </tr>`).join('');
  const ce = window._meta?.centros_excluidos || 0, co = window._meta?.colisiones || 0;
  document.getElementById('rankNote').innerHTML = `${rows.length} universidades` + (rows.length > 300 ? ' (mostrando 300)' : '') +
    `. Índice impact-weighted. ${window._meta?.q1pend ? 'Calidad %Q1 (SCImago) en proceso para las de menor puesto. ' : ''}` +
    `<strong>Auditado</strong>: se excluyeron ${ce} centros/institutos (no universidades) y ${co} colisión de afiliación (OpenAlex mezcló una entidad extranjera homónima). ` +
    `Fuente: OpenAlex (CC0)${window._meta?.extraido ? ', ' + window._meta.extraido : ''}.`;
}

function paisAgg() {
  const m = {};
  U.forEach(u => { const c = u.cc; (m[c] = m[c] || { cc: c, n: 0, works: 0, lider: null }); m[c].n++; m[c].works += (u.works || 0); if (!m[c].lider || u.score > m[c].lider.score) m[c].lider = u; });
  return Object.values(m).sort((a, b) => b.works - a.works);
}
function drawPaises() {
  const agg = paisAgg();
  const top = agg.slice(0, 14);
  new Chart(cPais, { type: 'bar', data: { labels: top.map(p => (FLAG[p.cc] || '') + ' ' + (PAIS[p.cc] || p.cc)), datasets: [{ data: top.map(p => p.works), backgroundColor: PRIMARY }] }, options: opts({ indexAxis: 'y', plugins: { legend: { display: false } } }) });
  new Chart(cPaisN, { type: 'bar', data: { labels: top.map(p => (FLAG[p.cc] || '') + ' ' + (PAIS[p.cc] || p.cc)), datasets: [{ data: top.map(p => p.n), backgroundColor: ORO }] }, options: opts({ indexAxis: 'y', plugins: { legend: { display: false } } }) });
  document.querySelector('#tPais tbody').innerHTML = agg.map(p => `<tr>
    <td><span class="flag">${FLAG[p.cc] || ''}</span>${esc(PAIS[p.cc] || p.cc)}</td>
    <td class="n">${p.n}</td><td>${esc(p.lider.name)}</td>
    <td class="n"><strong>${p.lider.score}</strong></td><td class="n">${fmtN(p.works)}</td></tr>`).join('');
}
function opts(extra = {}) {
  return Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } }, scales: { x: { grid: { color: grid() } }, y: { grid: { color: grid() }, beginAtZero: true } } }, extra);
}

function drawMap() {
  if (mapObj) { mapObj.remove(); mapObj = null; }
  mapObj = L.map('map', { scrollWheelZoom: false, worldCopyJump: true }).setView([-5, -55], 3);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (isDark() ? 'dark_all' : 'light_all') + '/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap, CARTO', maxZoom: 12 }).addTo(mapObj);
  const maxS = Math.max(...U.map(u => u.score));
  // color por top de la región: oro=top20, azul=resto; borde por región
  const withGeo = U.filter(u => u.lat && u.lng);
  withGeo.forEach(u => {
    const r = 3 + 15 * Math.pow(u.score / maxS, 1.3);
    const top20 = u.rank <= 20;
    L.circleMarker([u.lat, u.lng], {
      radius: r, weight: top20 ? 2 : 1,
      color: u.region === 'España' ? '#c99a2e' : '#2b4a9e',
      fillColor: top20 ? '#c99a2e' : (u.region === 'España' ? '#e0c06a' : '#4d6fd0'),
      fillOpacity: top20 ? .85 : .5
    }).bindPopup(`<strong>#${u.rank} · ${esc(u.name)}</strong><br>${FLAG[u.cc] || ''} ${esc(PAIS[u.cc] || u.cc)}<br>Índice <b>${u.score}</b> · h-index ${u.h ?? '—'} · ${fmtN(u.works)} publicaciones${u.q1_pct != null ? ' · ' + u.q1_pct + '% Q1' : ''}`).addTo(mapObj);
  });
  // leyenda
  const lg = L.control({ position: 'bottomright' });
  lg.onAdd = () => { const div = L.DomUtil.create('div'); div.style.cssText = 'background:var(--card);color:var(--tinta);padding:9px 12px;border-radius:10px;border:1px solid var(--line);font-size:12px;line-height:1.7;box-shadow:var(--shadow)'; div.innerHTML = '<b>Leyenda</b><br><span style="color:#c99a2e">●</span> Top 20 de la región<br><span style="color:#2b4a9e">●</span> Latinoamérica<br><span style="color:#e0c06a">●</span> España<br><small>tamaño = índice de impacto</small>'; return div; };
  lg.addTo(mapObj);
}

let cmpChart = null;
function drawCmp() {
  const a = U.find(u => u.oa === document.getElementById('cmpA').value);
  const b = U.find(u => u.oa === document.getElementById('cmpB').value);
  if (!a || !b) return;
  const maxes = { works: Math.max(a.works, b.works), cited: Math.max(a.cited, b.cited), h: Math.max(a.h || 0, b.h || 0), cpp: Math.max(a.cpp || 0, b.cpp || 0), q1: Math.max(a.q1_pct || 0, b.q1_pct || 0) };
  const norm = u => [u.works / maxes.works, u.cited / maxes.cited, (u.h || 0) / maxes.h, (u.cpp || 0) / (maxes.cpp || 1), (u.q1_pct || 0) / (maxes.q1 || 1)].map(x => Math.round(x * 100));
  if (cmpChart) cmpChart.destroy();
  cmpChart = new Chart(cCmp, {
    type: 'radar',
    data: { labels: ['Publicaciones', 'Citas', 'h-index', 'Citas/pub', '%Q1'], datasets: [
      { label: a.name.slice(0, 30), data: norm(a), borderColor: PRIMARY, backgroundColor: 'rgba(43,74,158,.18)' },
      { label: b.name.slice(0, 30), data: norm(b), borderColor: ORO, backgroundColor: 'rgba(201,154,46,.18)' },
    ] },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: grid() }, angleLines: { color: grid() }, pointLabels: { font: { size: 12 } }, ticks: { display: false } } } }
  });
  const row = (lbl, x, y, f = fmtN) => `<tr><td>${lbl}</td><td class="n">${f(x)}</td><td class="n">${f(y)}</td></tr>`;
  document.getElementById('cmpTable').innerHTML = `<div class="card"><div class="scroll"><table><thead><tr><th>Indicador</th><th class="n">${esc(a.name.slice(0, 26))}</th><th class="n">${esc(b.name.slice(0, 26))}</th></tr></thead><tbody>
    ${row('Puesto', a.rank, b.rank)}${row('Índice', a.score, b.score, x => x)}${row('Publicaciones', a.works, b.works)}${row('Citas', a.cited, b.cited)}${row('h-index', a.h, b.h)}${row('Citas/pub', a.cpp, b.cpp, x => x ?? '—')}${row('%Q1', a.q1_pct, b.q1_pct, x => x != null ? x + '%' : '—')}
  </tbody></table></div></div>`;
}

async function sendChat() {
  const inp = document.getElementById('chatIn'), box = document.getElementById('msgs');
  const q = inp.value.trim(); if (!q) return; inp.value = '';
  box.insertAdjacentHTML('beforeend', `<div class="m u">${esc(q)}</div>`);
  const wait = document.createElement('div'); wait.className = 'm a'; wait.textContent = '…'; box.appendChild(wait); box.scrollTop = box.scrollHeight;
  let ctx = 'Eres el asistente del Ranking de Universidades de Latinoamérica y España, bibliométrico y abierto (OpenAlex CC0). Responde corto, en español, solo sobre el ranking. No inventes.';
  if (U[0]) ctx += ` #1 región: ${U[0].name} (índice ${U[0].score}). Total ${U.length} universidades, 21 países.`;
  const topLat = U.find(u => u.region === 'Latinoamérica'); if (topLat) ctx += ` #1 Latinoamérica: ${topLat.name}.`;
  try {
    const r = await fetch(CFG.AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Token': CFG.AI_TOKEN }, body: JSON.stringify({ project: CFG.AI_PROJECT, messages: [{ role: 'system', content: ctx }, { role: 'user', content: q }] }) });
    const j = await r.json(); wait.textContent = j.reply || j.message || 'No pude responder ahora.';
  } catch { wait.textContent = 'Servicio no disponible por ahora.'; }
  box.scrollTop = box.scrollHeight;
}
boot();
