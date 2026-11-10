/* The room weaves: the contributor's page. A person builds ONE symbol on the flag's grid, 23 cells
 * across and up to 61 lines down, one line at a time. The line being drawn sits in a raised module with
 * a chevron at each end; above it the symbol so far; below it the option's source, then Accept (primary)
 * and Post (secondary). Accept takes the shown option as the symbol's next line. Post sends the whole
 * symbol to the wall (display.html); at 61 lines it posts itself.
 *
 * Suggestions come from the printer's dictionary (the 120 ends of the 1953 plates, pool.txt) cut into
 * its lines. Nothing drawn: the lines that follow your last line in the dictionary (for the first line,
 * the lines the ends begin with). Cells drawn: the dictionary's lines that contain them, fewest added
 * cells first; else the nearest by cells. One option shows at a time, as crosses; the chevrons swap it,
 * the last being the line exactly as drawn. Lookup only, form only.
 *
 * The store takes pieces of at most nine rows, so a symbol travels as pieces tagged
 * "s:<symbol id>:<piece>:<which pieces exist>" in each piece's `exact` field. Plain canvas, no libraries.
 */
'use strict';
const D = window.ENDS, W = D.w, H = 61, PIECE = 9;
const BANDAPI = 'https://ornament-rows.netlify.app/.netlify/functions/ends';
const API = /github\.io$/.test(location.hostname) ? BANDAPI : '/.netlify/functions/ends';
const $ = id => document.getElementById(id);

// ---------- the dictionary, cut into lines
const LINES = new Map(), FIRST = new Map();
for (const e of D.ends) { let first = true; e.rows.forEach((r, i) => {
  if (!r.includes('#')) return;
  let L = LINES.get(r); if (!L) { L = { row: r, set: new Set([...r].map((c, x) => c === '#' ? x : -1).filter(x => x >= 0)), n: 0, src: `${e.name} · line ${i + 1}`, next: new Map() }; LINES.set(r, L); }
  L.n++; if (first) { FIRST.set(r, (FIRST.get(r) || 0) + 1); first = false; }
  const nx = e.rows[i + 1]; if (nx && nx.includes('#')) L.next.set(nx, (L.next.get(nx) || 0) + 1); }); }
const ALL = [...LINES.values()];

// ---------- state
let ink = new Set(), cur = 0, block = [], props = [], pk = 0, log = [], busy = false, netMsg = '';
const BY = (() => { try { let m = localStorage.getItem('ornament-by'); if (!m) { m = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join(''); localStorage.setItem('ornament-by', m); } return m; } catch (e) { return 'ANON'; } })();
try { const s = JSON.parse(localStorage.getItem('ornament-symbol') || 'null'); if (Array.isArray(s) && s.every(r => typeof r === 'string' && r.length === W)) block = s.slice(0, H); } catch (e) {}
const keep = () => { try { localStorage.setItem('ornament-symbol', JSON.stringify(block)); } catch (e) {} };
const rowOf = set => Array.from({ length: W }, (_, x) => set.has(x) ? '#' : '.').join('');

function propose() {
  props = []; pk = 0; const lastLine = block.length ? LINES.get(block[block.length - 1]) : null;
  const follows = lastLine ? lastLine.next : (block.length ? new Map() : FIRST), what = block.length ? 'follows your last line' : 'an end of the plates begins so';
  if (!ink.size) { [...follows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([r, c]) => { const L = LINES.get(r);
      props.push({ L, add: [...L.set], lack: [], why: `${what} · ${c}× in the dictionary` }); }); return; }
  const typed = [...ink], sup = [], near = [];
  for (const L of ALL) { const missing = typed.filter(x => !L.set.has(x)).length, add = [...L.set].filter(x => !ink.has(x));
    if (!missing) { if (add.length) sup.push({ L, add, f: follows.get(L.row) || 0 }); } else near.push({ L, add, d: missing + add.length }); }
  sup.sort((a, b) => (b.f > 0) - (a.f > 0) || a.add.length - b.add.length || b.L.n - a.L.n);
  sup.slice(0, 8).forEach(c => props.push({ L: c.L, add: c.add, lack: [], why: `contains your cells · +${c.add.length}` + (c.f && block.length ? ' · follows your last line' : '') }));
  if (!sup.length) { near.sort((a, b) => a.d - b.d || b.L.n - a.L.n);
    near.slice(0, 5).forEach(c => props.push({ L: c.L, add: c.add, lack: typed.filter(x => !c.L.set.has(x)), why: `nearest by cells · ${c.d} differ` })); }
  props.push({ own: true, add: [], lack: [], why: 'exactly as you drew it' });
}
// Accept: the shown option (a dictionary line, or the line as drawn) becomes the symbol's next line
function accept() { const p = props[pk]; if (!p || busy || block.length >= H) return; for (const x of p.add) ink.add(x); if (!ink.size) return;
  log.push({ t: Date.now(), ev: 'accept', own: !!p.own, line: p.own ? null : p.L.src, typed: ink.size - p.add.length, k: pk, n: props.length });
  block.push(rowOf(ink)); ink = new Set(); cur = 0; keep(); if (block.length >= H) post(); else refresh(); }
function swap(d) { if (props.length < 2) return; pk = (pk + d + props.length) % props.length; render(); }
function takeBack() { if (!block.length || busy) return; block.pop(); keep(); refresh(); }

// Post: the whole symbol goes to the wall, in pieces of nine lines
async function post() { if (busy) return; if (!block.length && ink.size) { block.push(rowOf(ink)); ink = new Set(); cur = 0; }
  if (!block.length) return; busy = true; netMsg = 'posting…'; render();
  const rows = block.slice(), pieces = []; for (let k = 0; k * PIECE < rows.length; k++) pieces.push(rows.slice(k * PIECE, (k + 1) * PIECE));
  const mask = pieces.reduce((m, p, k) => m | (p.some(r => r.includes('#')) ? 1 << k : 0), 0), id = Math.random().toString(36).slice(2, 10);
  const todo = pieces.map((p, k) => [p, k]).filter(([, k]) => mask >> k & 1); let sent = 0;
  for (const [p, k] of todo) { let ok = false;
    for (let tries = 0; tries < 4 && !ok; tries++) { try { const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: p, exact: `s:${id}:${k}:${mask}`, by: BY }) }); ok = (await r.json()).ok === true; } catch (e) {}
      if (!ok) await new Promise(r => setTimeout(r, 800)); }
    if (!ok) { busy = false; netMsg = 'not posted: no connection. Post again.'; render(); return; }
    netMsg = `posting ${++sent} of ${todo.length}`; render(); }
  log.push({ t: Date.now(), ev: 'post', lines: rows.length }); block = []; keep(); busy = false; netMsg = `posted · ${rows.length} lines · look at the wall`; refresh(); }

// ---------- the line: tap or drag to ink; a drag that starts on an inked cell erases
function bindLine() { const cv = $('line'); let mode = null, lastX = -1;
  const at = e => { const r = cv.getBoundingClientRect(); return Math.max(0, Math.min(W - 1, Math.floor((e.clientX - r.left) / r.width * W))); };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} const x = at(e); mode = !ink.has(x); lastX = x; cur = x; if (mode) ink.add(x); else ink.delete(x); refresh(); });
  cv.addEventListener('pointermove', e => { if (mode === null) return; const x = at(e); if (x === lastX) return;
    const step = x > lastX ? 1 : -1; for (let i = lastX + step; i !== x + step; i += step) { if (mode) ink.add(i); else ink.delete(i); } lastX = x; cur = x; refresh(); });
  const up = () => { mode = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); }
function fitCanvas(cv, wCss, hCss) { const dpr = window.devicePixelRatio || 1; if (cv.width !== Math.round(wCss * dpr) || cv.height !== Math.round(hCss * dpr)) { cv.width = Math.round(wCss * dpr); cv.height = Math.round(hCss * dpr); }
  cv.style.width = wCss + 'px'; cv.style.height = hCss + 'px'; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return g; }
function renderLine(p) { const cv = $('line'), wCss = cv.parentElement.clientWidth - 12 - 2 * 40, cw = wCss / W, eh = 40, g = fitCanvas(cv, wCss, eh); g.clearRect(0, 0, wCss, eh);
  for (let x = 0; x < W; x++) { g.fillStyle = ink.has(x) ? '#e8e8e8' : '#1a1a1a'; g.fillRect(x * cw + 1, 1, cw - 2, eh - 2); }
  if (p) { g.lineWidth = 2; g.strokeStyle = '#8fb3ff'; const cy = eh / 2, r = Math.min(cw / 2 - 2, 7);
    for (const x of p.add) { const cx = x * cw + cw / 2; g.beginPath(); g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.stroke(); }
    g.strokeStyle = '#d9b65a'; for (const x of p.lack) g.strokeRect(x * cw + 3, 4, cw - 6, eh - 8); }
  g.lineWidth = 2; g.strokeStyle = '#3373f2'; g.strokeRect(cur * cw + 1, 1, cw - 2, eh - 2); }
// the symbol so far: 23 by 61, small; the next line's place is marked
function renderSymbol() { const px = Math.max(3, Math.min(8, Math.floor((window.innerHeight - 250) / H))), g = fitCanvas($('sym'), W * px, H * px + 14);
  g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, W * px, H * px);
  block.forEach((r, y) => { g.fillStyle = LINES.has(r) ? '#a8a8a8' : '#f0f0f0'; for (let x = 0; x < W; x++) if (r[x] === '#') g.fillRect(x * px, y * px, px - (px > 3 ? 1 : 0), px - (px > 3 ? 1 : 0)); });
  if (block.length < H) { g.fillStyle = 'rgba(51,115,242,.55)'; g.fillRect(0, block.length * px, W * px, Math.max(1, px - 1)); }
  g.clearRect(0, H * px, W * px, 14); }

function refresh() { propose(); render(); }
function render() { const p = props[pk]; renderSymbol(); renderLine(p);
  $('who').textContent = `you are ${BY} · line ${Math.min(H, block.length + 1)} of ${H}`; $('net').textContent = netMsg;
  $('cap').innerHTML = p ? `<b>${p.own ? 'your line' : p.L.src}</b><span>${p.why} · ${pk + 1} of ${props.length}</span>` : `<span>Drag along the dark line to draw.</span>`;
  $('prev').disabled = $('nextb').disabled = props.length < 2; $('accept').disabled = !p || busy;
  $('post').disabled = busy || !(block.length || ink.size); $('post').textContent = block.length ? `Post ${block.length} of ${H}` : 'Post'; }
$('prev').onclick = () => swap(-1); $('nextb').onclick = () => swap(1); $('accept').onclick = accept; $('post').onclick = post; $('sym').onclick = takeBack;
window.addEventListener('keydown', e => { const k = e.key;
  if (k === 'Enter' || k === 'Tab') { e.preventDefault(); accept(); } else if (k === 'ArrowLeft') { cur = Math.max(0, cur - 1); render(); } else if (k === 'ArrowRight') { cur = Math.min(W - 1, cur + 1); render(); }
  else if (k === 'h') { ink.add(cur); cur = Math.max(0, cur - 1); refresh(); } else if (k === 'l') { ink.add(cur); cur = Math.min(W - 1, cur + 1); refresh(); }
  else if (k === ' ') { e.preventDefault(); if (ink.has(cur)) ink.delete(cur); else ink.add(cur); refresh(); } else if (k === ',') swap(-1); else if (k === '.') swap(1); else if (k === 'p') post(); });
window.addEventListener('resize', render); bindLine(); refresh();
