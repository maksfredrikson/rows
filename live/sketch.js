/* The room weaves: the contributor's page. One column: the common band above, then a raised module that
 * holds the person's block and, at its bottom, the line being drawn with a chevron at each end; the
 * option's source below; then Accept (primary) and Post (secondary) side by side.
 *
 * A person builds a BLOCK of up to nine lines, one line at a time. Accept takes the shown option into the
 * block. Post sends the whole block to the common band (it posts itself at nine lines). A block is the
 * dictionary's own unit and the smallest that holds a figure, so twenty people's contributions stack
 * without cutting each other up.
 *
 * Suggestions come from the printer's dictionary (the 120 ends of the 1953 plates) cut into its lines.
 * With nothing drawn: the lines that follow the line before (the block's last, else the band's last) in
 * the dictionary. With cells drawn: the dictionary's lines that contain them, fewest added cells first;
 * else the nearest by cells. One option shows at a time, as crosses; the chevrons swap it, the last being
 * the line exactly as drawn. Lookup only, form only.
 */
'use strict';
const D = window.ENDS, W = D.w, MAXB = 9, PAD = 10;
const BANDAPI = 'https://ornament-rows.netlify.app/.netlify/functions/ends';
// the band's API is beside the page on Netlify and on the laptop relay; any other host uses Netlify's
const API = /github\.io$/.test(location.hostname) ? BANDAPI : '/.netlify/functions/ends';
if (location.hash === '#display') location.replace('display.html');      // the common display is the playing record
const PX = Math.max(10, Math.min(22, Math.floor((Math.min(window.innerWidth, 560) - 2 * PAD - 4) / W)));
const BAND = window.innerHeight < 760 ? 10 : 16;

// ---------- the dictionary, cut into lines
const LINES = new Map();            // row string -> { row, set, n, src, next: Map(row -> count) }
for (const e of D.ends) e.rows.forEach((r, i) => {
  if (!r.includes('#')) return;
  let L = LINES.get(r); if (!L) { L = { row: r, set: new Set([...r].map((c, x) => c === '#' ? x : -1).filter(x => x >= 0)), n: 0, src: `${e.name} · line ${i + 1}`, next: new Map() }; LINES.set(r, L); }
  L.n++; const nx = e.rows[i + 1]; if (nx && nx.includes('#')) L.next.set(nx, (L.next.get(nx) || 0) + 1);
});
const ALL = [...LINES.values()], ENDKEY = new Map(D.ends.map(e => [e.rows.join('/'), e.name]));

// ---------- state
let ink = new Set(), cur = 0, block = [], props = [], pk = 0, log = [], shared = [], lastT = 0, netMsg = '', busy = false;
const BY = (() => { try { let m = localStorage.getItem('ornament-by'); if (!m) { m = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join(''); localStorage.setItem('ornament-by', m); } return m; } catch (e) { return 'ANON'; } })();
const rowOf = set => Array.from({ length: W }, (_, x) => set.has(x) ? '#' : '.').join('');
function bandLines() { const out = []; for (const e of shared) e.rows.forEach((r, i) => out.push({ row: r, exact: e.ex ? !!e.ex[i] : !!e.exact, mine: e.by === BY })); return out; }

function propose() {
  props = []; pk = 0; const band = bandLines();
  const before = block.length ? block[block.length - 1] : (band.length ? band[band.length - 1].row : null), lastLine = before ? LINES.get(before) : null;
  const follows = lastLine ? lastLine.next : new Map(), what = block.length ? 'your last line' : 'the band’s last line';
  if (!ink.size) { [...follows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([r, c]) => { const L = LINES.get(r);
      props.push({ L, add: [...L.set], lack: [], why: `follows ${what} · ${c}× in the dictionary` }); }); return; }
  const typed = [...ink], sup = [], near = [];
  for (const L of ALL) { const missing = typed.filter(x => !L.set.has(x)).length, add = [...L.set].filter(x => !ink.has(x));
    if (!missing) { if (add.length) sup.push({ L, add, f: follows.get(L.row) || 0 }); } else near.push({ L, add, d: missing + add.length }); }
  sup.sort((a, b) => (b.f > 0) - (a.f > 0) || a.add.length - b.add.length || b.L.n - a.L.n);
  sup.slice(0, 8).forEach(c => props.push({ L: c.L, add: c.add, lack: [], why: `contains your cells · +${c.add.length}` + (c.f ? ` · follows ${what}` : '') }));
  if (!sup.length) { near.sort((a, b) => a.d - b.d || b.L.n - a.L.n);
    near.slice(0, 5).forEach(c => props.push({ L: c.L, add: c.add, lack: typed.filter(x => !c.L.set.has(x)), why: `nearest by cells · ${c.d} differ` })); }
  props.push({ own: true, add: [], lack: [], why: 'exactly as you drew it' });
}
// Accept: the shown option (a dictionary line, or the line as drawn) becomes the next line of the block
function accept() { const p = props[pk]; if (!p || busy) return; for (const x of p.add) ink.add(x); if (!ink.size) return;
  log.push({ t: Date.now(), ev: 'accept', own: !!p.own, line: p.own ? null : p.L.src, typed: ink.size - p.add.length, k: pk, n: props.length });
  block.push(rowOf(ink)); ink = new Set(); cur = 0; if (block.length >= MAXB) post(); else refresh(); }
function swap(d) { if (props.length < 2) return; pk = (pk + d + props.length) % props.length; log.push({ t: Date.now(), ev: 'swap', k: pk }); render(); }
function takeBack(i) { if (i < 0 || i >= block.length || busy) return; log.push({ t: Date.now(), ev: 'takeback', i }); block.splice(i, 1); refresh(); }

// ---------- the common band
async function poll() { try { const r = await fetch(`${API}?since=${lastT}`, { cache: 'no-store' }); const j = await r.json();
    let grew = false; if (j.ends) for (const e of j.ends) if (!shared.some(s => (s.id || s.t) === (e.id || e.t))) { shared.push(e); grew = true; }
    if (grew) { shared.sort((a, b) => a.t - b.t); lastT = shared[shared.length - 1].t; if (!ink.size && !block.length) propose(); }
    if (j.n === 0 && shared.length) { shared = []; lastT = 0; propose(); }
    netMsg = `${bandLines().length} lines on the band`; } catch (e) { netMsg = 'band unreachable'; } render(); }
// Post: the whole block goes to the band. With an empty block, the line as drawn is the block.
async function post() { if (busy) return; if (!block.length && ink.size) { block.push(rowOf(ink)); ink = new Set(); cur = 0; }
  if (!block.length) return; const rows = block.slice(), ex = rows.map(r => LINES.has(r) ? 1 : 0), exact = rows.length === 9 ? (ENDKEY.get(rows.join('/')) || null) : null;
  busy = true; netMsg = 'posting…'; render();
  for (let tries = 0; tries < 3; tries++) { try { const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows, ex, exact, by: BY }) }); const j = await r.json();
      if (j.ok) { shared.push({ id: j.id, t: j.t, rows, ex, exact, by: BY }); lastT = Math.max(lastT, j.t); log.push({ t: Date.now(), ev: 'post', rows, ex }); block = []; netMsg = `posted ${rows.length} line${rows.length > 1 ? 's' : ''}`; busy = false; refresh(); return; }
      netMsg = 'not posted: ' + (j.error || r.status); break; } catch (e) { netMsg = 'not posted, trying again…'; render(); await new Promise(r => setTimeout(r, 900)); } }
  busy = false; if (/trying/.test(netMsg)) netMsg = 'not posted: band unreachable. Post again.'; render(); }

// ---------- input
function keyPressed() { const k = window.key, c = keyCode;
  if (c === TAB || c === ENTER || c === RETURN) { accept(); return false; }
  if (c === LEFT_ARROW) { cur = Math.max(0, cur - 1); render(); return false; }
  if (c === RIGHT_ARROW) { cur = Math.min(W - 1, cur + 1); render(); return false; }
  if (k === 'h') { ink.add(cur); cur = Math.max(0, cur - 1); refresh(); return false; }
  if (k === 'l') { ink.add(cur); cur = Math.min(W - 1, cur + 1); refresh(); return false; }
  if (k === ' ') { if (ink.has(cur)) ink.delete(cur); else ink.add(cur); refresh(); return false; }
  if (k === ',') { swap(-1); return false; } if (k === '.') { swap(1); return false; }
  if (k === 'p') { post(); return false; } }
// the module's canvas: the block's lines stacked small on top, the line being drawn tall at the bottom.
// A tap or drag on the bottom line inks cells; a tap on a block line takes it back.
let M = { cw: 10, bh: 10, eh: 40, top: 0 };
function bindLine() { const cv = document.getElementById('line'); let mode = null, lastX = -1;
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(W - 1, Math.floor((e.clientX - r.left) / r.width * W))), e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); const [x, y] = at(e);
    if (y < M.top) { takeBack(Math.floor(y / M.bh)); return; }
    try { cv.setPointerCapture(e.pointerId); } catch (err) {} mode = !ink.has(x); lastX = x; cur = x; if (mode) ink.add(x); else ink.delete(x); refresh(); });
  cv.addEventListener('pointermove', e => { if (mode === null) return; const [x] = at(e); if (x === lastX) return;
    const step = x > lastX ? 1 : -1; for (let i = lastX + step; i !== x + step; i += step) { if (mode) ink.add(i); else ink.delete(i); } lastX = x; cur = x; refresh(); });
  const up = () => { mode = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); }
function renderLine(p) { const cv = document.getElementById('line'), wCss = cv.clientWidth || 300, cw = wCss / W, bh = Math.max(8, Math.round(cw)), eh = 40;      // the chevrons either side are this high
  const top = block.length ? block.length * bh + 6 : 0, hCss = top + eh, dpr = window.devicePixelRatio || 1; M = { cw, bh, eh, top };
  if (cv.width !== Math.round(wCss * dpr) || cv.height !== Math.round(hCss * dpr)) { cv.width = Math.round(wCss * dpr); cv.height = Math.round(hCss * dpr); cv.style.height = hCss + 'px'; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, wCss, hCss);
  block.forEach((r, j) => { g.fillStyle = LINES.has(r) ? '#a8a8a8' : '#f0f0f0'; for (let x = 0; x < W; x++) if (r[x] === '#') g.fillRect(x * cw + 1, j * bh + 1, cw - 2, bh - 2); });
  for (let x = 0; x < W; x++) { g.fillStyle = ink.has(x) ? '#e8e8e8' : '#1a1a1a'; g.fillRect(x * cw + 1, top + 1, cw - 2, eh - 2); }
  if (p) { g.lineWidth = 2; g.strokeStyle = '#8fb3ff'; const cy = top + eh / 2, r = Math.min(cw / 2 - 2, 7);
    for (const x of p.add) { const cx = x * cw + cw / 2; g.beginPath(); g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.stroke(); }
    g.strokeStyle = '#d9b65a'; for (const x of p.lack) g.strokeRect(x * cw + 3, top + 4, cw - 6, eh - 8); }
  g.lineWidth = 2; g.strokeStyle = '#3373f2'; g.strokeRect(cur * cw + 1, top + 1, cw - 2, eh - 2); }

// ---------- drawing
function setup() { const cv = createCanvas(W * PX + 2 * PAD, BAND * PX + 2 * PAD + 14); cv.parent('stage'); noLoop();
  document.getElementById('prev').onclick = () => swap(-1); document.getElementById('nextb').onclick = () => swap(1);
  document.getElementById('accept').onclick = accept; document.getElementById('post').onclick = post;
  bindLine(); window.addEventListener('resize', render); poll(); setInterval(poll, 4000); refresh(); }
function refresh() { propose(); render(); }
function render() {
  background(20); noStroke();
  const band = bandLines().slice(-BAND), base = BAND - band.length;
  band.forEach((b, i) => { fill(b.mine ? 235 : (b.exact ? 130 : 185)); for (let x = 0; x < W; x++) if (b.row[x] === '#') rect(PAD + x * PX + 1, PAD + (base + i) * PX + 1, PX - 2, PX - 2); });
  const p = props[pk]; renderLine(p);
  document.getElementById('pos').textContent = `you are ${BY}`;
  document.getElementById('net').textContent = netMsg;
  document.getElementById('cap').innerHTML = p ? `<b>${p.own ? 'your line' : p.L.src}</b><span>${p.why} · ${pk + 1} of ${props.length}</span>` : `<span>Drag along the dark line to draw.</span>`;
  document.getElementById('prev').disabled = document.getElementById('nextb').disabled = props.length < 2;
  document.getElementById('accept').disabled = !p || busy;
  const pb = document.getElementById('post'); pb.disabled = busy || !(block.length || ink.size);
  pb.textContent = block.length ? `Post ${block.length} of ${MAXB}` : 'Post';
}
