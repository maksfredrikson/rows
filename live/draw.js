/* The room weaves, simplest form: each person draws ONE symbol on the flag's own grid, 23 cells across
 * and 61 down, and posts it. The display (display.html) shows the wall of symbols forming as the room
 * submits. No dictionary, no suggestions: the form is the person's. Mirror is a drawing aid only (what
 * is drawn on one side is drawn on the other); switch it off to draw freely. Form only.
 *
 * The band's store takes pieces of at most nine rows, so a symbol travels as up to seven pieces, each
 * tagged "s:<symbol id>:<piece>:<which pieces exist>" in the piece's `exact` field; blank pieces are
 * not sent. Plain canvas, no libraries.
 */
'use strict';
const W = 23, H = 61, PIECE = 9;
const BANDAPI = 'https://ornament-rows.netlify.app/.netlify/functions/ends';
// the band's API is beside the page on Netlify and on the laptop relay; any other host uses Netlify's
const API = /github\.io$/.test(location.hostname) ? BANDAPI : '/.netlify/functions/ends';
const BY = (() => { try { let m = localStorage.getItem('ornament-by'); if (!m) { m = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join(''); localStorage.setItem('ornament-by', m); } return m; } catch (e) { return 'ANON'; } })();
const $ = id => document.getElementById(id), cv = $('cv'), g = cv.getContext('2d');
let cells = new Uint8Array(W * H), mirror = true, PX = 12, busy = false, posted = false;
try { const s = JSON.parse(localStorage.getItem('ornament-draft') || 'null'); if (s && s.length === W * H) cells = Uint8Array.from(s); } catch (e) {}

function size() { PX = Math.max(8, Math.min(16, Math.floor((Math.min(window.innerWidth, 520) - 84) / W)));     // gutters left and right stay free for scrolling
  const dpr = window.devicePixelRatio || 1; cv.style.width = W * PX + 'px'; cv.style.height = H * PX + 'px'; cv.width = W * PX * dpr; cv.height = H * PX * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
function draw() { g.fillStyle = '#1d1d1d'; g.fillRect(0, 0, W * PX, H * PX);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = cells[y * W + x] ? '#ececec' : '#262626'; g.fillRect(x * PX + 1, y * PX + 1, PX - 2, PX - 2); }
  if (mirror) { g.fillStyle = 'rgba(143,179,255,.35)'; g.fillRect((W / 2) * PX - 0.5, 0, 1, H * PX); }
  const n = cells.reduce((a, b) => a + b, 0); $('post').disabled = busy || !n; $('who').textContent = `you are ${BY} · ${n} cells`; }
function put(x, y, v) { if (x < 0 || x >= W || y < 0 || y >= H) return; cells[y * W + x] = v; if (mirror) cells[y * W + (W - 1 - x)] = v; }
function save() { try { localStorage.setItem('ornament-draft', JSON.stringify([...cells])); } catch (e) {} }

// drawing: a drag paints; a drag that starts on an inked cell erases; fast strokes are joined cell to cell
let mode = null, last = null;
const at = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / PX), Math.floor((e.clientY - r.top) / PX)]; };
cv.addEventListener('pointerdown', e => { if (posted) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  const [x, y] = at(e); if (x < 0 || x >= W || y < 0 || y >= H) return; mode = cells[y * W + x] ? 0 : 1; put(x, y, mode); last = [x, y]; draw(); });
cv.addEventListener('pointermove', e => { if (mode === null) return; const [x, y] = at(e); if (x === last[0] && y === last[1]) return;
  let [x0, y0] = last; const dx = Math.abs(x - x0), dy = Math.abs(y - y0), sx = x0 < x ? 1 : -1, sy = y0 < y ? 1 : -1; let err = dx - dy;
  for (let i = 0; i < 200; i++) { put(x0, y0, mode); if (x0 === x && y0 === y) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } }
  last = [x, y]; draw(); });
const up = () => { if (mode !== null) save(); mode = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

$('mirror').onclick = () => { mirror = !mirror; $('mirror').classList.toggle('on', mirror); $('mirror').textContent = mirror ? 'Mirror on' : 'Mirror off'; draw(); };
$('clear').onclick = () => { if (posted) { posted = false; $('done').style.display = 'none'; cv.style.display = 'block'; $('clear').textContent = 'Clear'; $('net').textContent = ''; }
  cells = new Uint8Array(W * H); save(); draw(); };
$('post').onclick = post;

async function post() { if (busy) return; busy = true; draw();
  const rows = []; for (let y = 0; y < H; y++) { let s = ''; for (let x = 0; x < W; x++) s += cells[y * W + x] ? '#' : '.'; rows.push(s); }
  const pieces = []; for (let k = 0; k * PIECE < H; k++) pieces.push(rows.slice(k * PIECE, (k + 1) * PIECE));
  const mask = pieces.reduce((m, p, k) => m | (p.some(r => r.includes('#')) ? 1 << k : 0), 0), id = Math.random().toString(36).slice(2, 10);
  const todo = pieces.map((p, k) => [p, k]).filter(([, k]) => mask >> k & 1); let sent = 0;
  for (const [p, k] of todo) { let ok = false;
    for (let tries = 0; tries < 4 && !ok; tries++) { try { const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: p, exact: `s:${id}:${k}:${mask}`, by: BY }) }); ok = (await r.json()).ok === true; } catch (e) {}
      if (!ok) await new Promise(r => setTimeout(r, 800)); }
    if (!ok) { busy = false; $('net').textContent = 'not posted: no connection. Post again.'; $('net').style.color = '#d9b65a'; draw(); return; }
    $('net').textContent = `posting ${++sent} of ${todo.length}`; }
  busy = false; posted = true; $('net').style.color = ''; $('net').textContent = 'posted'; try { localStorage.removeItem('ornament-draft'); } catch (e) {}
  cv.style.display = 'none'; $('done').style.display = 'block'; $('clear').textContent = 'Draw another'; $('post').disabled = true; window.scrollTo(0, 0); }

window.addEventListener('resize', size); size();
