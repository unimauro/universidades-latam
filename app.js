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

let U = [], sortK = 'rank', sortAsc = true, mapObj = null, cmpSel = {};

// ---- Combobox con buscador (reemplaza el <select> nativo feo) ----
function makeCombo(id, initialOa, onPick) {
  const box = document.getElementById(id); if (!box) return;
  const sel = initialOa ? U.find(u => u.oa === initialOa) : null;
  cmpSel[id] = sel && sel.oa;
  box.innerHTML = `<input readonly placeholder="${box.dataset.ph || 'Buscar universidad…'}"><div class="list"></div>`;
  const inp = box.querySelector('input'), list = box.querySelector('.list');
  let hi = -1, shown = [];
  const setLabel = () => { const s = U.find(u => u.oa === cmpSel[id]); inp.value = s ? s.name : ''; };
  const draw = q => {
    q = (q || '').trim().toLowerCase();
    shown = U.filter(u => !q || (`${u.name} ${PAIS[u.cc] || ''}`).toLowerCase().includes(q)).slice(0, 80);
    hi = -1;
    list.innerHTML = shown.length ? shown.map(u => `<div class="opt" data-oa="${esc(u.oa)}"><span class="orank">#${u.rank}</span><span class="oflag">${FLAG[u.cc] || ''}</span><span class="oname">${esc(u.name)} <small>${esc(PAIS[u.cc] || u.cc)}</small></span></div>`).join('') : '<div class="empty">Sin resultados</div>';
  };
  const open = () => { box.classList.add('open'); inp.removeAttribute('readonly'); inp.value = ''; draw(''); inp.focus(); };
  const close = () => { box.classList.remove('open'); inp.setAttribute('readonly', ''); setLabel(); };
  const pick = oa => { cmpSel[id] = oa; close(); if (onPick) onPick(oa); else drawCmp(); };
  inp.addEventListener('focus', () => !box.classList.contains('open') && open());
  inp.addEventListener('mousedown', e => { if (!box.classList.contains('open')) { e.preventDefault(); open(); } });
  inp.addEventListener('input', () => draw(inp.value));
  list.addEventListener('mousedown', e => { const o = e.target.closest('.opt'); if (o) { e.preventDefault(); pick(o.dataset.oa); } });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, shown.length - 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); mark(); }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(shown[hi].oa); }
    else if (e.key === 'Escape') close();
  });
  const mark = () => { [...list.children].forEach((c, i) => c.classList.toggle('hi', i === hi)); if (list.children[hi]) list.children[hi].scrollIntoView({ block: 'nearest' }); };
  box._close = close; close();
}
document.addEventListener('mousedown', e => document.querySelectorAll('.combo.open').forEach(b => { if (!b.contains(e.target) && b._close) b._close(); }));

async function boot() {
  try { const r = await fetch('data/universidades.json?v=' + Date.now()); const d = await r.json(); const all = d.unis || []; window._meta = d.meta || {}; window._centros = all.filter(x => x.tipo && x.tipo !== 'universidad'); U = all.filter(x => !x.tipo || x.tipo === 'universidad'); } catch { U = []; }
  // poblar filtro país y comparador
  const paises = [...new Set(U.map(u => u.cc))].sort((a, b) => (PAIS[a] || a).localeCompare(PAIS[b] || b));
  document.getElementById('fPais').insertAdjacentHTML('beforeend', paises.map(c => `<option value="${c}">${FLAG[c] || ''} ${esc(PAIS[c] || c)}</option>`).join(''));
  U.forEach(u => { const t = trend(u); u.trend = t ? t.pct : null; }); // precalcular trayectoria p/ ordenar
  makeCombo('cmpA', U[0] && U[0].oa); makeCombo('cmpB', U[1] && U[1].oa);
  makeCombo('heroSearch', null, pickHero); // buscador del hero → tarjeta compartible
  // listeners
  document.getElementById('q').addEventListener('input', drawRank);
  document.getElementById('fReg').addEventListener('change', drawRank);
  document.getElementById('fPais').addEventListener('change', drawRank);
  document.querySelectorAll('#tRank th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; sortAsc = sortK === k ? !sortAsc : (k === 'name' || k === 'cc'); sortK = k; drawRank(); }));
  render();
}
function render() { renderPodio(); renderKpis(); drawRank(); drawPaises(); drawMap(); drawCmp(); }

// ---- Trayectoria: crecimiento en años CERRADOS (excluye parciales 2026-2027) ----
const LAST_CLOSED = 2025; // último año con indexación razonablemente completa en OpenAlex
function trend(u) {
  const by = (u.by || []).filter(y => y.y <= LAST_CLOSED && y.w > 0);
  if (by.length < 6) return null;
  const w = {}; by.forEach(y => w[y.y] = y.w);
  const rec = [2023, 2024, 2025].map(y => w[y] || 0), prev = [2020, 2021, 2022].map(y => w[y] || 0);
  const ar = rec.reduce((a, b) => a + b, 0) / 3, ap = prev.reduce((a, b) => a + b, 0) / 3;
  if (!ap) return null;
  const pct = Math.round(100 * (ar - ap) / ap);
  return { pct, dir: pct > 4 ? 'up' : pct < -4 ? 'down' : 'flat', spark: by.slice(-8).map(y => y.w) };
}
function sparkSVG(vals, dir) {
  if (!vals || vals.length < 2) return '';
  const w = 46, h = 16, mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - mn) / rng * h).toFixed(1)}`).join(' ');
  const col = dir === 'up' ? '#1d9e6a' : dir === 'down' ? '#d1495b' : '#8a94ad';
  return `<svg width="${w}" height="${h}" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5"/></svg>`;
}

// ---- Podio top 3 en el hero (elemento vendedor) ----
function renderPodio() {
  const el = document.getElementById('podio'); if (!el || !U.length) return;
  const medals = ['🥇', '🥈', '🥉'], pos = ['1.º de la región', '2.º de la región', '3.º de la región'];
  el.innerHTML = U.slice(0, 3).map((u, i) => `
    <div class="pod p${i + 1}">
      <div class="medal">${medals[i]}</div>
      <div class="pos">${pos[i]}</div>
      <div class="pname">${esc(u.name)}</div>
      <div class="pmeta">${FLAG[u.cc] || ''} ${esc(PAIS[u.cc] || u.cc)} · h-index ${u.h ?? '—'}</div>
      <div class="pscore">${u.score}<small> / 100 índice</small></div>
    </div>`).join('');
}

// ---- #1 "Encuentra tu universidad" → tarjeta compartible ----
function pickHero(oa) {
  const u = U.find(x => x.oa === oa); if (!u) return;
  const el = document.getElementById('miCard'); if (!el) return;
  const t = trend(u), tr = t ? `${t.dir === 'up' ? '▲ +' : t.dir === 'down' ? '▼ ' : '▬ '}${t.pct}% en producción (últimos años)` : '';
  el.innerHTML = `<div class="micard">
    <div class="mtop"><span class="mflag">${FLAG[u.cc] || '🎓'}</span>
      <div><div class="mrk">#${u.rank} <small>de ${window._meta?.n || U.length} · ${esc(PAIS[u.cc] || u.cc)}</small></div></div></div>
    <div class="mname">${esc(u.name)}</div>
    <div class="mstats"><span>Índice <b>${u.score}</b></span><span>h-index <b>${u.h ?? '—'}</b></span><span><b>${fmtN(u.works)}</b> publicaciones</span>${u.q1_pct != null ? `<span><b>${u.q1_pct}%</b> en Q1</span>` : ''}</div>
    ${tr ? `<div class="mstats" style="margin-top:6px">${tr}</div>` : ''}
    <div class="mbtns">
      <button class="mbtn p" onclick="shareCard('${esc(u.oa)}')">⬇ Descargar imagen</button>
      <button class="mbtn s" onclick="location.hash='#ranking';document.getElementById('q').value='${esc(u.name).replace(/'/g, "\\'")}';document.getElementById('q').dispatchEvent(new Event('input'))">Ver en la tabla</button>
    </div></div>`;
}
// genera un PNG bonito para compartir
function shareCard(oa) {
  const u = U.find(x => x.oa === oa); if (!u) return;
  const W = 1080, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a1330'); g.addColorStop(.5, '#0e1a3a'); g.addColorStop(1, '#1b2c5a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // estrellas
  for (let i = 0; i < 80; i++) { x.beginPath(); x.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, 7); x.fillStyle = 'rgba(200,214,245,' + (Math.random() * .5 + .1) + ')'; x.fill(); }
  x.textAlign = 'center';
  x.fillStyle = '#e6c065'; x.font = '600 34px Georgia'; x.fillText('RANKING DE UNIVERSIDADES · LATINOAMÉRICA Y ESPAÑA', W / 2, 130);
  x.font = '120px serif'; x.fillText(FLAG[u.cc] || '🎓', W / 2, 320);
  x.fillStyle = '#fff'; x.font = '700 180px Georgia'; x.fillText('#' + u.rank, W / 2, 500);
  x.fillStyle = '#c3d0ee'; x.font = '34px Georgia'; x.fillText(`de ${window._meta?.n || U.length} universidades · ${PAIS[u.cc] || u.cc}`, W / 2, 560);
  // nombre (wrap simple)
  x.fillStyle = '#fff'; x.font = '600 52px Georgia';
  const words = u.name.split(' '); let line = '', y = 680;
  words.forEach(wd => { if (x.measureText(line + wd).width > W - 160) { x.fillText(line.trim(), W / 2, y); line = ''; y += 64; } line += wd + ' '; });
  x.fillText(line.trim(), W / 2, y);
  // stats
  x.fillStyle = '#e6c065'; x.font = '600 40px Georgia';
  x.fillText(`Índice ${u.score}   ·   h-index ${u.h ?? '—'}   ·   ${fmtN(u.works)} publicaciones`, W / 2, y + 110);
  x.fillStyle = '#8fa0cc'; x.font = '30px Georgia'; x.fillText('unimauro.github.io/universidades-latam · datos OpenAlex (CC0)', W / 2, H - 70);
  const a = document.createElement('a'); a.download = 'ranking-' + u.cc + '-' + u.rank + '.png'; a.href = c.toDataURL('image/png'); a.click();
}

// ---- Constelación de fondo del hero ----
function starfield() {
  const c = document.getElementById('stars'); if (!c) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = c.getContext('2d'); let stars = [], raf = null;
  function size() { c.width = c.offsetWidth; c.height = c.offsetHeight; stars = Array.from({ length: Math.min(90, Math.floor(c.width / 14)) }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.4 + .3, a: Math.random() * .5 + .2, s: Math.random() * .4 + .1 })); }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(st => { ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fillStyle = `rgba(${st.r > 1.1 ? '230,192,101' : '200,214,245'},${st.a})`; ctx.fill(); if (!reduce) { st.y -= st.s; if (st.y < 0) { st.y = c.height; st.x = Math.random() * c.width; } } });
    if (!reduce) raf = requestAnimationFrame(draw);
  }
  size(); draw(); window.addEventListener('resize', () => { if (raf) cancelAnimationFrame(raf); size(); draw(); });
}
starfield();

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
  const maxScore = U[0] ? U[0].score : 100;
  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '';
  tb.innerHTML = rows.slice(0, 300).map(u => `<tr class="${u.rank <= 3 ? 'top' : ''}">
    <td class="rk">${medal(u.rank) || u.rank}</td>
    <td><span class="uname">${esc(u.name)}</span></td>
    <td><span class="flag">${FLAG[u.cc] || ''}</span>${esc(PAIS[u.cc] || u.cc)}</td>
    <td class="n"><span class="idx"><span class="ibar"><i style="width:${Math.round(100 * u.score / maxScore)}%"></i></span><b>${u.score}</b></span></td>
    <td class="n">${fmtN(u.works)}</td>
    <td class="n">${fmtN(u.cited)}</td>
    <td class="n">${u.h ?? '—'}</td>
    <td class="n">${u.cpp ?? '—'}</td>
    <td class="n">${u.q1_pct != null ? u.q1_pct + '%' : '<span class="pill">…</span>'}</td>
    <td class="n">${(() => { const t = trend(u); if (!t) return '—'; const ar = t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '▬'; const cl = t.dir === 'up' ? '#1d9e6a' : t.dir === 'down' ? '#d1495b' : '#8a94ad'; return `<span class="trend" style="color:${cl};display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">${sparkSVG(t.spark, t.dir)} ${ar}${t.pct > 0 ? '+' : ''}${t.pct}%</span>`; })()}</td>
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
  const a = U.find(u => u.oa === cmpSel.cmpA);
  const b = U.find(u => u.oa === cmpSel.cmpB);
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
