/* Ornament keyboard: a typewriter for ornament with autocomplete from the 1953 plates.
 * Strokes are typed cell by cell (hjkl, yubn). After every change the figure under the
 * last stroke is read, and completions are proposed as crosses (cells to add) and
 * dashes (cells the completion leaves blank). Every proposal names its source:
 *   word    the dictionary: a figure of the plates that contains what is typed (T9 / SPELL)
 *   rule    an authored rule from the measured construction grammar (mirror pair, fourfold)
 *   next    the plates: what stands to the right of this figure, at its recorded offset
 *   repeat  the plates: the figure next to itself, at its recorded offset
 *   build   the construction trees: the typed figure is a stage in how the plates build a figure
 *           (an atom, or the state after a step); the next step of that construction is proposed
 * Nothing is applied without Tab. Form only: no symbol is given a meaning.
 */
'use strict';
const W = 47, VIEW = 23, PAD = 8;
const PX = Math.max(7, Math.min(18, Math.floor((Math.min(window.innerWidth, 900) - 2 * PAD - 8) / W)));
const D = window.SPELL;
const FRAG = /^(colour part|blob|solid figure|repeat piece|block|bar|mirror half)$/;

// ---------- transforms, as in spell_v2 (numpy rot90 is counter-clockwise; +flipx mirrors left-right)
const rot = rows => { const h = rows.length, w = rows[0].length, out = [];
  for (let y = 0; y < w; y++) { let s = ''; for (let x = 0; x < h; x++) s += rows[x][w - 1 - y]; out.push(s); } return out; };
const flipx = rows => rows.map(r => [...r].reverse().join(''));
const tf = (rows, k) => { let r = rows; for (let i = 0; i < k % 4; i++) r = rot(r); return k >= 4 ? flipx(r) : r; };
const rkey = rows => rows.join('/');
function turnPair(aRows, bRows, dr, dc, k) {
  const ah = aRows.length, aw = aRows[0].length, bh = bRows.length, bw = bRows[0].length;
  const r0 = Math.min(0, dr), c0 = Math.min(0, dc), Hc = Math.max(ah, dr + bh) - r0, Wc = Math.max(aw, dc + bw) - c0;
  const cv = Array.from({ length: Hc }, () => Array(Wc).fill('.'));
  aRows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cv[y - r0][x - c0] = 'a'; }));
  bRows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cv[dr - r0 + y][dc - c0 + x] = 'b'; }));
  const t = tf(cv.map(r => r.join('')), k);
  const box = m => { let y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1; t.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === m) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); } })); return [y0, y1, x0, x1]; };
  const [ay0, , ax0] = box('a'), [by0, by1, bx0, bx1] = box('b');
  const rows = []; for (let y = by0; y <= by1; y++) { let s = ''; for (let x = bx0; x <= bx1; x++) s += t[y][x] === 'b' ? '#' : '.'; rows.push(s); }
  return { rows, dr: by0 - ay0, dc: bx0 - ax0 };
}
const cellsOf = rows => { const o = []; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') o.push([y, x]); })); return o; };

// ---------- dictionary: whole figures of the core tier, with their 8 variants
const words = D.words.filter(w => w.tier === 'core' && !FRAG.test(w.cls));
const byId = new Map(D.words.map(w => [w.id, w]));
for (const w of words) {
  w.area = cellsOf(w.rows).length; w.v = [];
  const seen = new Set();
  for (let k = 0; k < 8; k++) { const r = tf(w.rows, k), kk = rkey(r); if (seen.has(kk)) continue; seen.add(kk);
    w.v.push({ k, rows: r, h: r.length, w: r[0].length, cells: cellsOf(r), set: new Set(cellsOf(r).map(c => c.join(','))) }); }
}
const canon = new Map(); for (const w of words) for (const v of w.v) canon.set(rkey(v.rows), [w, v.k]);
// construction trees (build_data.js): for every figure and every one of its turns and mirrors, the cells
// present after each step, each state normalised to its own box so a typed figure can be matched anywhere
const norm = cells => { const y0 = Math.min(...cells.map(c => c[0])), x0 = Math.min(...cells.map(c => c[1]));
  return { y0, x0, key: cells.map(([y, x]) => (y - y0) + ',' + (x - x0)).sort().join(';') }; };
const BUILDS = [];
for (const b of ((window.BUILD && window.BUILD.words) || [])) {
  const stages = []; let acc = [];
  for (const st of b.steps) { acc = acc.concat(st.cells.filter(([y, x]) => !acc.some(([a, c]) => a === y && c === x))); stages.push({ t: st.t, g: st.g, cells: acc.slice() }); }
  const seen = new Set();
  for (let k = 0; k < 8; k++) {
    const grid = Array.from({ length: b.h }, () => Array(b.w).fill('.'));
    const frames = stages.map(s => { const g = grid.map(r => r.slice()); for (const [y, x] of s.cells) g[y][x] = '#'; return cellsOf(tf(g.map(r => r.join('')), k)); });
    const sig = frames.map(f => norm(f).key).join('|'); if (seen.has(sig)) continue; seen.add(sig);
    BUILDS.push({ word: b, k, frames: frames.map((f, i) => Object.assign(norm(f), { cells: f, t: stages[i].t, g: stages[i].g })) });
  }
}
// the production rules' page counts (DESIGN_SYSTEM.md §4.5), used to label the authored rules
const RULES = { pair: 'mirror pair, axial · 89 of 287 sheets', four: 'fourfold mirror · 47 of 287 sheets', beside: 'mirror pair beside, as the bands mostly repeat · 137 of 383 bands' };

// ---------- the band
let ink = new Set(), cur = { y: 0, x: 0 }, last = null, hist = [], props = [], pk = 0, log = [];
const K = (y, x) => y + ',' + x;
const has = (y, x) => ink.has(K(y, x));
function snapshot() { hist.push({ ink: new Set(ink), cur: { ...cur }, last }); if (hist.length > 100) hist.shift(); }
function undo() { const s = hist.pop(); if (!s) return; ink = s.ink; cur = s.cur; last = s.last; log.push({ t: Date.now(), ev: 'undo' }); refresh(); }

// the figure: the 8-connected component holding the last stroke
function figure() {
  if (!last || !ink.has(last)) return null;
  const seen = new Set([last]), q = [last], cells = [];
  while (q.length) { const k = q.pop(); const [y, x] = k.split(',').map(Number); cells.push([y, x]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const kk = K(y + dy, x + dx); if (ink.has(kk) && !seen.has(kk)) { seen.add(kk); q.push(kk); } } }
  const ys = cells.map(c => c[0]), xs = cells.map(c => c[1]);
  const y0 = Math.min(...ys), x0 = Math.min(...xs), h = Math.max(...ys) - y0 + 1, w = Math.max(...xs) - x0 + 1;
  const rows = []; for (let y = 0; y < h; y++) { let s = ''; for (let x = 0; x < w; x++) s += seen.has(K(y0 + y, x0 + x)) ? '#' : '.'; rows.push(s); }
  return { cells, y0, x0, h, w, rows, set: seen };
}
const inBand = (y, x) => y >= 0 && x >= 0 && x < W;

// ---------- proposals
function propose() {
  props = []; pk = 0;
  const F = figure(); if (!F) return;
  const exact = canon.get(rkey(F.rows));          // the figure is a word of the plates as it stands
  const seenSets = new Set();
  const push = p => { p.add = p.add.filter(([y, x]) => inBand(y, x) && !has(y, x)); if (!p.add.length) return;
    const sig = p.add.map(c => c.join(',')).sort().join(';'); if (seenSets.has(sig)) return; seenSets.add(sig); props.push(p); };

  // build: the typed figure is exactly the state after step i of a figure's construction: propose step i+1.
  // Or it lies inside that state: propose the rest of step i. Ranked by the figure's sheets.
  const fn = norm(F.cells), builds = [];
  for (const bd of BUILDS) for (let i = 0; i < bd.frames.length; i++) {
    const fr = bd.frames[i]; if (fr.cells.length < F.cells.length) continue;
    const dy = F.y0 - fr.y0, dx = F.x0 - fr.x0;
    const inside = F.cells.every(([y, x]) => fr.cells.some(([a, c]) => a + dy === y && c + dx === x));
    if (!inside) continue;
    const exactStage = fr.key === fn.key;
    const target = exactStage ? bd.frames[i + 1] : fr; if (!target) continue;
    const add = target.cells.map(([y, x]) => [y + dy, x + dx]).filter(([y, x]) => !F.set.has(K(y, x)));
    if (add.some(([y, x]) => has(y, x))) continue;            // would run into other ink
    builds.push({ src: 'build', word: bd.word, add, blank: [], exactStage, label: (exactStage ? target.t : 'finish ' + fr.t) + ' → ' + bd.word.name, n: `${bd.word.pages} sheets · step ${(exactStage ? i + 2 : i + 1)} of ${bd.frames.length}` });
  }
  builds.sort((a, b) => b.word.pages - a.word.pages || a.add.length - b.add.length);
  builds.filter(b => b.exactStage).slice(0, 4).forEach(push);          // the next step of a construction leads the list
  // word: every placement of the figure inside a variant of a word, cell for cell; no stray ink inside the box.
  // Offered even when the figure is already a word (an atom is a word too): T9 keeps proposing longer words.
  const wordCands = (() => {
    const cands = [];
    for (const w of words) for (const v of w.v) {
      if (v.h < F.h || v.w < F.w || w.area <= F.cells.length) continue;
      for (let oy = 0; oy + F.h <= v.h; oy++) for (let ox = 0; ox + F.w <= v.w; ox++) {
        if (!F.cells.every(([y, x]) => v.set.has((y - F.y0 + oy) + ',' + (x - F.x0 + ox)))) continue;
        const Y = F.y0 - oy, X = F.x0 - ox; let clash = false; const add = [], blank = [];
        for (let y = 0; y < v.h && !clash; y++) for (let x = 0; x < v.w; x++) {
          const on = v.set.has(y + ',' + x), inked = has(Y + y, X + x);
          if (inked && !on) { clash = true; break; }
          if (on && !inked) add.push([Y + y, X + x]); if (!on) blank.push([Y + y, X + x]); }
        if (clash || !inBand(Y, X) || X + v.w > W) continue;
        cands.push({ src: 'word', word: w, k: v.k, add, blank, label: `${w.name}`, n: `${w.pages} sheets · ${w.n} on the plates · +${add.length}` });
      } }
    cands.sort((a, b) => a.add.length - b.add.length || b.word.pages - a.word.pages);
    return cands.slice(0, 4);
  })();
  if (!exact) wordCands.forEach(push);
  builds.filter(b => !b.exactStage).slice(0, 3).forEach(push);         // then finishing the step the figure lies inside
  // rule: orbit completion, the commonest groups of identical parts in the construction grammar
  const mx = F.cells.map(([y, x]) => [y, 2 * F.x0 + F.w - 1 - x]);           // mirror across the figure's own centre column
  const my = F.cells.map(([y, x]) => [2 * F.y0 + F.h - 1 - y, x]);           // across its centre row
  const symX = mx.every(([y, x]) => F.set.has(K(y, x))), symY = my.every(([y, x]) => F.set.has(K(y, x)));
  if (!symX) push({ src: 'rule', add: mx, blank: [], label: 'complete the mirror pair about the centre column', n: RULES.pair });
  if (!symX || !symY) { const four = [...mx, ...my, ...F.cells.map(([y, x]) => [2 * F.y0 + F.h - 1 - y, 2 * F.x0 + F.w - 1 - x])]; push({ src: 'rule', add: four, blank: [], label: 'complete the fourfold mirror', n: RULES.four }); }
  // rule, generalised from the production rules: the commonest way two strokes are put together on the plates is a
  // mirror pair meeting at an end (89 sheets for bars, 78 for diagonals), then a half turn (40). The join is the last cell typed.
  if (last) { const [ly, lx] = last.split(',').map(Number);
    push({ src: 'rule', add: F.cells.map(([y, x]) => [y, 2 * lx - x]), blank: [], label: 'mirror pair meeting at the last cell, across its column', n: 'strokes: 2 × [mirror pair, axial] · joins meet · 89 of 287 sheets' });
    push({ src: 'rule', add: F.cells.map(([y, x]) => [2 * ly - y, x]), blank: [], label: 'mirror pair meeting at the last cell, across its row', n: 'strokes: 2 × [mirror pair, axial] · joins meet · 78 of 287 sheets' });
    push({ src: 'rule', add: F.cells.map(([y, x]) => [2 * ly - y, 2 * lx - x]), blank: [], label: 'half turn about the last cell', n: 'strokes: 2 × [half turn] · 40 of 287 sheets' }); }
  // next and repeat: what the plates put to the right of this word, at the recorded offset
  if (exact) {
    const [w, k] = exact, g = D.grammar[w.id] || {}; let n = 0;
    for (const [nid, count, dr, dc] of (g.right || [])) {
      const nb = byId.get(nid); if (!nb || n >= 3) continue;
      const t = turnPair(w.rows, nb.rows, dr, dc, k);
      const add = cellsOf(t.rows).map(([y, x]) => [F.y0 + t.dr + y, F.x0 + t.dc + x]);
      const self = nid === w.id;
      push({ src: self ? 'repeat' : 'next', word: nb, add, blank: [], label: self ? `${w.name} next to itself` : `${nb.name} to the right`, n: `${count} times on the plates` }); n++;
    }
  } else push({ src: 'rule', add: F.cells.map(([y, x]) => [y, 2 * F.x0 + 2 * F.w - x]), blank: [], label: 'mirror pair beside it, one cell apart', n: RULES.beside });
  if (!props.some(p => p.src === 'repeat')) push({ src: 'rule', add: F.cells.map(([y, x]) => [y, x + F.w + 1]), blank: [], label: 'repeat it, one cell apart', n: 'authored · period = width + 1' });
  if (exact) wordCands.forEach(push);          // longer words that contain this one, after the plates' neighbours
}
function accept() {
  const p = props[pk]; if (!p) return; snapshot();
  for (const [y, x] of p.add) ink.add(K(y, x));
  const a = p.add[p.add.length - 1]; last = K(a[0], a[1]);
  if (p.src === 'next' || p.src === 'repeat') { cur.y = a[0]; cur.x = Math.min(W - 1, a[1] + 1); }
  log.push({ t: Date.now(), ev: 'accept', src: p.src, id: p.word ? p.word.id : null, label: p.label, k: pk, n: props.length });
  refresh();
}
function refuse() { if (props.length) log.push({ t: Date.now(), ev: 'refuse', src: props[pk].src, id: props[pk].word ? props[pk].word.id : null, k: pk, n: props.length }); props = []; pk = 0; render(); }

// ---------- typing
function typeStroke(dy, dx) { snapshot(); ink.add(K(cur.y, cur.x)); last = K(cur.y, cur.x);
  const ny = cur.y + dy, nx = cur.x + dx; if (inBand(ny, nx)) { cur.y = ny; cur.x = nx; } refresh(); }
function keyPressed() {
  const k = window.key, c = keyCode;
  if (c === TAB) { accept(); return false; }
  if (c === ESCAPE) { refuse(); return false; }
  if (c === BACKSPACE) { undo(); return false; }
  if (c === ENTER || c === RETURN) { cur.y += 1; cur.x = 0; render(); return false; }
  if (c === LEFT_ARROW) { cur.x = Math.max(0, cur.x - 1); render(); return false; }
  if (c === RIGHT_ARROW) { cur.x = Math.min(W - 1, cur.x + 1); render(); return false; }
  if (c === UP_ARROW) { cur.y = Math.max(0, cur.y - 1); render(); return false; }
  if (c === DOWN_ARROW) { cur.y += 1; render(); return false; }
  const S = { h: [0, -1], j: [1, 0], k: [-1, 0], l: [0, 1], y: [-1, -1], u: [-1, 1], b: [1, -1], n: [1, 1] };
  if (S[k]) { typeStroke(...S[k]); return false; }
  if (k === ' ') { snapshot(); const kk = K(cur.y, cur.x); if (ink.has(kk)) ink.delete(kk); else { ink.add(kk); last = kk; } refresh(); return false; }
  if (k === 'z') { undo(); return false; }
  if (k >= '1' && k <= '9') { if (props[+k - 1]) { pk = +k - 1; render(); } return false; }
  if (k === ',') { if (props.length) { pk = (pk + props.length - 1) % props.length; render(); } return false; }
  if (k === '.') { if (props.length) { pk = (pk + 1) % props.length; render(); } return false; }
  if (k === 'C') { snapshot(); ink = new Set(); last = null; cur = { y: 0, x: 0 }; log.push({ t: Date.now(), ev: 'clear' }); refresh(); return false; }
  if (k === 's') { saveJSON({ about: 'ornament keyboard log, form only', band: [...ink], log }, 'keyboard-log.json'); return false; }
}

// ---------- drawing
let topRow = 0;
function setup() { const cv = createCanvas(W * PX + 2 * PAD, VIEW * PX + 2 * PAD); cv.parent('stage'); cv.elt.style.touchAction = 'none'; noLoop(); refresh();
  document.getElementById('buttons').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    ({ accept, refuse, undo, next: () => { if (props.length) { pk = (pk + 1) % props.length; render(); } }, row: () => { cur.y += 1; cur.x = 0; render(); } })[b.dataset.do](); }); }
// touch and mouse: a tap inks or uninks a cell and moves the cursor there
function mousePressed() { const x = Math.floor((mouseX - PAD) / PX), y = Math.floor((mouseY - PAD) / PX) + topRow;
  if (x < 0 || x >= W || y < topRow || y >= topRow + VIEW) return; snapshot(); cur = { y, x }; const kk = K(y, x); if (ink.has(kk)) ink.delete(kk); else { ink.add(kk); last = kk; } refresh(); return false; }
function touchStarted() { if (touches.length && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) { mousePressed(); return false; } }
function refresh() { propose(); render(); }
function render() {
  if (cur.y < topRow) topRow = cur.y; if (cur.y >= topRow + VIEW) topRow = cur.y - VIEW + 1;
  const p = props[pk];
  background(20);
  // the end stripe: every 23 cell rows close an end, as the printer does
  for (let y = 0; y < VIEW; y++) { const Y = topRow + y; if (Y > 0 && Y % VIEW === 0) { stroke(60); strokeWeight(1); line(PAD, PAD + y * PX - 2, PAD + W * PX, PAD + y * PX - 2); } }
  noStroke();
  for (let y = 0; y < VIEW; y++) for (let x = 0; x < W; x++) {
    const Y = topRow + y, X = x, px = PAD + x * PX, py = PAD + y * PX;
    fill(28); rect(px + PX / 2 - 1, py + PX / 2 - 1, 2, 2);
    if (has(Y, X)) { fill(232); rect(px + 1, py + 1, PX - 2, PX - 2); }
  }
  const F = figure();
  if (F) { noFill(); stroke(70); strokeWeight(1); rect(PAD + F.x0 * PX, PAD + (F.y0 - topRow) * PX, F.w * PX, F.h * PX); }
  if (p) {
    stroke(90); strokeWeight(2);
    for (const [Y, X] of p.blank) { if (has(Y, X) || Y < topRow || Y >= topRow + VIEW) continue; const px = PAD + X * PX, py = PAD + (Y - topRow) * PX; line(px + 5, py + PX / 2, px + PX - 5, py + PX / 2); }
    stroke(p.src === 'rule' ? '#d9b65a' : p.src === 'build' ? '#7fd6a4' : '#8fb3ff'); strokeWeight(2);
    for (const [Y, X] of p.add) { if (Y < topRow || Y >= topRow + VIEW) continue; const px = PAD + X * PX, py = PAD + (Y - topRow) * PX; line(px + 4, py + 4, px + PX - 4, py + PX - 4); line(px + PX - 4, py + 4, px + 4, py + PX - 4); }
  }
  noFill(); stroke('#3373f2'); strokeWeight(2); rect(PAD + cur.x * PX + 1, PAD + (cur.y - topRow) * PX + 1, PX - 2, PX - 2);
  // the DOM strip
  document.getElementById('dict').textContent = `${words.length} whole figures of the plates · figures only`;
  document.getElementById('pos').textContent = `row ${cur.y + 1} · col ${cur.x + 1}`;
  const ex = F && canon.get(rkey(F.rows));
  document.getElementById('fig').textContent = F ? (ex ? `${F.cells.length} cells · ${ex[0].name} · ${ex[0].pages} sheets` : `${F.cells.length} cells · ${F.h}×${F.w} · not a figure of the plates`) : '';
  const box = document.getElementById('props'); box.innerHTML = '';
  if (!props.length) { box.innerHTML = `<div id="empty">${F ? 'No completion from the plates for this figure. Keep typing, or press enter for a new row.' : 'Type a stroke. Completions come from the 1953 plates and are named by form only.'}</div>`; return; }
  props.forEach((q, i) => { const d = document.createElement('div'); d.className = 'p' + (i === pk ? ' on' : '');
    d.innerHTML = `<span class="k">${i + 1}</span><span class="src ${q.src === 'rule' ? 'rule' : q.src === 'build' ? 'build' : ''}">${q.src.toUpperCase()}</span>${q.word ? thumb(q.word.rows) : ''}<span>${q.label}</span><span class="n">${q.n}</span>`;
    d.addEventListener('click', () => { pk = i; render(); }); d.addEventListener('dblclick', () => { pk = i; accept(); }); box.appendChild(d); });
}
function thumb(rows) { const h = rows.length, w = rows[0].length, s = 3; const c = document.createElement('canvas'); c.width = w * s; c.height = h * s; const g = c.getContext('2d'); g.fillStyle = '#ccc';
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x * s, y * s, s - 0.5, s - 0.5); })); return `<img width="${w * s}" height="${h * s}" src="${c.toDataURL()}">`; }
