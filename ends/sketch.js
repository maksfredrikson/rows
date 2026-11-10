/* End typewriter: people type cells on a 23 x 9 end; the printer's dictionary (120 ends cut from the
 * 1953 plates, pool.txt) proposes the ends that contain what is typed, fewest added cells first, and
 * when none contains it, the nearest end by cells (Hamming, as ornament.h does). Crosses are cells the
 * end would add; dashes, cells it leaves blank; a hollow square, a typed cell the nearest end lacks.
 * No rules, no generation: every proposal is a whole end a weaver made. Tab accepts, "." is the
 * printer's next key. Enter finishes the end; finished ends stack above like the paper. Form only.
 */
'use strict';
const D = window.ENDS, W = D.w, H = D.h, PAD = 10, SHOW = window.innerWidth < 600 ? 1 : 2, GAP = 1;
let PX = Math.max(10, Math.min(20, Math.floor((Math.min(window.innerWidth, 800) - 2 * PAD - 8) / W)));
const ENDS = D.ends.map(e => { const cells = []; e.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') cells.push([y, x]); }));
  const ys = cells.map(c => c[0]), xs = cells.map(c => c[1]);
  return { name: e.name, rows: e.rows, cells, set: new Set(cells.map(c => c.join(','))), box: [Math.min(...ys), Math.max(...ys), Math.min(...xs), Math.max(...xs)] }; });
let ink = new Set(), cur = { y: 0, x: 0 }, hist = [], props = [], pk = 0, log = [], done = [];
const K = (y, x) => y + ',' + x, has = (y, x) => ink.has(K(y, x));
function snapshot() { hist.push({ ink: new Set(ink), cur: { ...cur } }); if (hist.length > 100) hist.shift(); }
function undo() { const s = hist.pop(); if (!s) return; ink = s.ink; cur = s.cur; log.push({ t: Date.now(), ev: 'undo' }); refresh(); }

function propose() {
  props = []; pk = 0; if (!ink.size) return;
  const typed = [...ink].map(k => k.split(',').map(Number));
  const sup = [], near = [];
  ENDS.forEach((e, i) => { const missing = typed.filter(([y, x]) => !e.set.has(K(y, x))).length;
    const add = e.cells.filter(([y, x]) => !has(y, x));
    if (!missing) { if (add.length) sup.push({ e, i, add, missing }); }
    else near.push({ e, i, add, missing, d: missing + add.length }); });
  sup.sort((a, b) => a.add.length - b.add.length);
  sup.slice(0, 6).forEach(c => props.push({ src: 'end', e: c.e, i: c.i, add: c.add, lack: [], label: c.e.name, n: `contains what you typed · +${c.add.length} cells` }));
  if (!sup.length) { near.sort((a, b) => a.d - b.d);
    near.slice(0, 4).forEach(c => props.push({ src: 'nearest', e: c.e, i: c.i, add: c.add, lack: typed.filter(([y, x]) => !c.e.set.has(K(y, x))), label: c.e.name, n: `nearest by cells · ${c.d} differ` })); }
}
function accept() { const p = props[pk]; if (!p) return; snapshot(); for (const [y, x] of p.add) ink.add(K(y, x));
  log.push({ t: Date.now(), ev: 'accept', src: p.src, end: p.i, name: p.e.name, k: pk, n: props.length, typed: ink.size - p.add.length }); refresh(); }
function next() { if (!props.length) return; log.push({ t: Date.now(), ev: 'next', src: props[pk].src, end: props[pk].i, k: pk }); pk = (pk + 1) % props.length; render(); }
function refuse() { if (props.length) log.push({ t: Date.now(), ev: 'refuse', end: props[pk].i, k: pk, n: props.length }); props = []; render(); }
function finish() { if (!ink.size) return; const rows = []; for (let y = 0; y < H; y++) { let s = ''; for (let x = 0; x < W; x++) s += has(y, x) ? '#' : '.'; rows.push(s); }
  const exact = ENDS.findIndex(e => e.rows.join('/') === rows.join('/'));
  done.push({ rows, exact }); log.push({ t: Date.now(), ev: 'end', rows, exact: exact >= 0 ? ENDS[exact].name : null });
  snapshot(); ink = new Set(); cur = { y: 0, x: 0 }; hist = []; refresh(); }
const inGrid = (y, x) => y >= 0 && y < H && x >= 0 && x < W;
function typeStroke(dy, dx) { snapshot(); ink.add(K(cur.y, cur.x)); if (inGrid(cur.y + dy, cur.x + dx)) { cur.y += dy; cur.x += dx; } refresh(); }
function keyPressed() {
  const k = window.key, c = keyCode;
  if (c === TAB) { accept(); return false; }
  if (c === ESCAPE) { refuse(); return false; }
  if (c === BACKSPACE) { undo(); return false; }
  if (c === ENTER || c === RETURN) { finish(); return false; }
  if (c === LEFT_ARROW) { cur.x = Math.max(0, cur.x - 1); render(); return false; }
  if (c === RIGHT_ARROW) { cur.x = Math.min(W - 1, cur.x + 1); render(); return false; }
  if (c === UP_ARROW) { cur.y = Math.max(0, cur.y - 1); render(); return false; }
  if (c === DOWN_ARROW) { cur.y = Math.min(H - 1, cur.y + 1); render(); return false; }
  const S = { h: [0, -1], j: [1, 0], k: [-1, 0], l: [0, 1], y: [-1, -1], u: [-1, 1], b: [1, -1], n: [1, 1] };
  if (S[k]) { typeStroke(...S[k]); return false; }
  if (k === ' ') { snapshot(); const kk = K(cur.y, cur.x); if (ink.has(kk)) ink.delete(kk); else ink.add(kk); refresh(); return false; }
  if (k === 'z') { undo(); return false; }
  if (k === '.') { next(); return false; }
  if (k >= '1' && k <= '9') { if (props[+k - 1]) { pk = +k - 1; render(); } return false; }
  if (k === 'C') { snapshot(); ink = new Set(); cur = { y: 0, x: 0 }; log.push({ t: Date.now(), ev: 'clear' }); refresh(); return false; }
  if (k === 's') { saveJSON({ about: 'end typewriter log, form only', ends: done, current: [...ink], log }, 'ends-log.json'); return false; }
}
function setup() { const cv = createCanvas(W * PX + 2 * PAD, (SHOW + 1) * (H + GAP) * PX + 2 * PAD); cv.parent('stage'); cv.elt.style.touchAction = 'none'; noLoop(); refresh();
  document.getElementById('buttons').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    ({ accept, next, refuse, undo, finish })[b.dataset.do](); }); }
// touch and mouse: a tap on the live end inks or uninks that cell and moves the cursor there
function mousePressed() { const oy = SHOW * (H + GAP); const x = Math.floor((mouseX - PAD) / PX), y = Math.floor((mouseY - PAD) / PX) - oy;
  if (!inGrid(y, x)) return; snapshot(); cur = { y, x }; const kk = K(y, x); if (ink.has(kk)) ink.delete(kk); else ink.add(kk); refresh(); return false; }
function touchStarted() { if (touches.length && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) { mousePressed(); return false; } }
function refresh() { propose(); render(); }
function cellRect(y, x, oy) { return [PAD + x * PX, PAD + (oy + y) * PX]; }
function render() {
  background(20); noStroke();
  // finished ends above, like the paper coming out of the printer
  const shown = done.slice(-SHOW); const base = (SHOW - shown.length) * (H + GAP);
  shown.forEach((e, i) => { const oy = base + i * (H + GAP); fill(e.exact >= 0 ? 150 : 200);
    e.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') { const [px, py] = cellRect(y, x, oy); rect(px + 1, py + 1, PX - 2, PX - 2); } })); });
  const oy = SHOW * (H + GAP);
  stroke(60); strokeWeight(1); line(PAD, PAD + oy * PX - PX / 2, PAD + W * PX, PAD + oy * PX - PX / 2); noStroke();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [px, py] = cellRect(y, x, oy); fill(30); rect(px + PX / 2 - 1, py + PX / 2 - 1, 2, 2); if (has(y, x)) { fill(232); rect(px + 1, py + 1, PX - 2, PX - 2); } }
  const p = props[pk];
  if (p) { const [y0, y1, x0, x1] = p.e.box; stroke(80); strokeWeight(2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!p.e.set.has(K(y, x)) && !has(y, x)) { const [px, py] = cellRect(y, x, oy); line(px + 6, py + PX / 2, px + PX - 6, py + PX / 2); }
    stroke('#8fb3ff'); for (const [y, x] of p.add) { const [px, py] = cellRect(y, x, oy); line(px + 5, py + 5, px + PX - 5, py + PX - 5); line(px + PX - 5, py + 5, px + 5, py + PX - 5); }
    stroke('#d9b65a'); noFill(); for (const [y, x] of p.lack) { const [px, py] = cellRect(y, x, oy); rect(px + 4, py + 4, PX - 8, PX - 8); } }
  noFill(); stroke('#3373f2'); strokeWeight(2); const [cx, cy] = cellRect(cur.y, cur.x, oy); rect(cx + 1, cy + 1, PX - 2, PX - 2);
  document.getElementById('dict').textContent = `${ENDS.length} ends of the 1953 plates, 23 × 9 · the printer's dictionary`;
  document.getElementById('pos').textContent = `row ${cur.y + 1} · col ${cur.x + 1} · end ${done.length + 1}`;
  const ex = ink.size && ENDS.find(e => e.set.size === ink.size && [...ink].every(k => e.set.has(k)));
  document.getElementById('fig').textContent = ink.size ? `${ink.size} cells` + (ex ? ` · ${ex.name}` : '') : '';
  const box = document.getElementById('props'); box.innerHTML = '';
  if (!props.length) { box.innerHTML = `<div id="empty">${ink.size ? 'This end is yours as it stands.' : 'Type cells on the end. The dictionary proposes the ends of the plates that contain what you typed.'}</div>`; return; }
  props.forEach((q, i) => { const d = document.createElement('div'); d.className = 'p' + (i === pk ? ' on' : '');
    d.innerHTML = `<span class="k">${i + 1}</span>${thumb(q.e.rows)}<span>${q.label}</span><span class="n">${q.n}</span>`;
    d.addEventListener('click', () => { pk = i; render(); }); d.addEventListener('dblclick', () => { pk = i; accept(); }); box.appendChild(d); });
}
function thumb(rows) { const s = 3, c = document.createElement('canvas'); c.width = W * s; c.height = H * s; const g = c.getContext('2d'); g.fillStyle = '#ccc';
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x * s, y * s, s - 0.5, s - 0.5); })); return `<img width="${W * s}" height="${H * s}" src="${c.toDataURL()}">`; }
