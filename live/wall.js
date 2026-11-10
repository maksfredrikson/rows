/* The wall: every symbol the room posts, 23 cells across and 61 down, laid out as a grid that re-fits
 * itself so all of them stay on screen. A new symbol forms row by row, top to bottom, and with Sound on
 * each forming row is strummed on a synthesised цымбалы (hammered dulcimer; an approximation, not a
 * recording), the 23 cells pitched in a Dorian mode on D, low at the left. Controls and the join code
 * are in the right column. Symbols arrive from the band's store as up to seven pieces tagged
 * "s:<symbol id>:<piece>:<which pieces exist>" and are shown once all their pieces are in (or after
 * 12 s with what has come). Plain canvas; the QR code needs qrcodejs. Form only.
 */
'use strict';
const W = 23, H = 61, PIECE = 9, FORM_MS = 3600;
const BANDAPI = 'https://ornament-rows.netlify.app/.netlify/functions/ends';
const API = /github\.io$/.test(location.hostname) ? BANDAPI : '/.netlify/functions/ends';
const CLOTH = '#efe6d6', TILE = '#f7f1e4', INK = '#34281a';
const $ = id => document.getElementById(id), cv = $('cv'), g = cv.getContext('2d');
const SINCE = 1794337969912;      // the symbol version began here; earlier posts (lines) are never fetched
let lastT = SINCE, seen = new Set(), parts = new Map(), wall = [], joinAt = location.host + location.pathname.replace(/display\.html$/, ''), qrFor = '', soundOn = false;

async function poll() { try { const r = await fetch(`${API}?since=${lastT}`, { cache: 'no-store' }); const j = await r.json();
    if (j.join) joinAt = j.join;
    if (j.n === 0 && (wall.length || parts.size)) { wall = []; parts = new Map(); seen = new Set(); lastT = SINCE; }
    for (const e of j.ends || []) { const key = e.id || e.t; if (seen.has(key)) continue; seen.add(key); lastT = Math.max(lastT, e.t);
      const m = /^s:([a-z0-9]+):(\d):(\d+)$/.exec(e.exact || ''); if (!m) continue;                     // lines from the earlier version are not symbols
      let p = parts.get(m[1]); if (!p) { p = { id: m[1], by: e.by, mask: +m[3], t: e.t, first: Date.now(), got: {} }; parts.set(m[1], p); }
      p.got[+m[2]] = e.rows; }
    const now = Date.now();
    for (const p of [...parts.values()].sort((a, b) => a.t - b.t)) { let have = 0; for (let k = 0; k < 7; k++) if (p.got[k]) have |= 1 << k;
      if (have !== p.mask && now - p.first < 12000) continue;
      const rows = []; for (let k = 0; k * PIECE < H; k++) { const n = Math.min(PIECE, H - k * PIECE), q = p.got[k] || []; for (let i = 0; i < n; i++) rows.push(q[i] || '.'.repeat(W)); }
      wall.push({ id: p.id, by: p.by, rows, born: booted ? now : 0 }); parts.delete(p.id); }
    booted = true; $('count').firstChild.nodeValue = wall.length; $('addr').textContent = joinAt; drawQR(); } catch (e) { $('now').textContent = 'band unreachable'; } }
let booted = false;      // symbols already on the band when the page opens appear whole; later ones form
function drawQR() { const el = $('qr'), url = (/^https?:/.test(joinAt) ? '' : location.protocol + '//') + joinAt;
  if (!window.QRCode) { el.style.display = 'none'; return; } if (url === qrFor) return; qrFor = url; el.innerHTML = '';
  new QRCode(el, { text: url, width: 480, height: 480, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); el.onclick = () => el.classList.toggle('big'); }

// ---------- sound: one strum per forming row
const audio = { ctx: null, out: null }, strings = new Map(), MODE = [0, 2, 3, 5, 7, 9, 10];
const hz = i => 146.83 * Math.pow(2, (12 * Math.floor(i / 7) + MODE[i % 7]) / 12);
function ensureAudio() { if (!audio.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = audio.ctx = new AC(); audio.out = c.createGain(); audio.out.gain.value = 0.8;
    const comp = c.createDynamicsCompressor(), ir = c.createBuffer(2, Math.floor(c.sampleRate * 1.4), c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    const rev = c.createConvolver(), wet = c.createGain(); rev.buffer = ir; wet.gain.value = 0.22; audio.out.connect(comp); audio.out.connect(rev); rev.connect(wet); wet.connect(comp); comp.connect(c.destination); }
  if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); }
function stringBuffer(f) { const key = Math.round(f * 10); if (strings.has(key)) return strings.get(key);
  const sr = audio.ctx.sampleRate, len = Math.floor(sr * 1.8), buf = audio.ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
  for (const det of [1, 1.0035]) { const N = Math.max(2, Math.round(sr / (f * det))), y = new Float32Array(len), damp = 0.9965 - Math.min(0.004, f / 400000); let prev = 0;
    for (let i = 0; i < N; i++) { const n = Math.random() * 2 - 1; prev = 0.55 * n + 0.45 * prev; y[i] = prev * (1 - 0.6 * Math.cos(2 * Math.PI * i / N * 3)); }
    for (let i = N; i < len; i++) y[i] = damp * 0.5 * (y[i - N] + y[i - N + 1]); for (let i = 0; i < len; i++) out[i] += y[i] * 0.5; }
  strings.set(key, buf); return buf; }
function strum(row, n) { if (!soundOn || !audio.ctx) return; const on = []; for (let i = 0; i < W; i++) if (row[i] === '#') on.push(i); if (!on.length) return;
  const t0 = audio.ctx.currentTime + 0.02, gain = Math.min(0.16, 0.5 / Math.sqrt(on.length)), order = n % 2 ? on : on.slice().reverse();
  order.forEach((i, v) => { const c = audio.ctx, s = c.createBufferSource(), gg = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
    s.buffer = stringBuffer(hz(i)); gg.gain.setValueAtTime(gain * (0.8 + Math.random() * 0.4), t0 + v * 0.012); gg.gain.setTargetAtTime(0.0001, t0 + 1, 0.25);
    s.connect(gg); if (p) { p.pan.value = i / (W - 1) * 1.2 - 0.6; gg.connect(p); p.connect(audio.out); } else gg.connect(audio.out); s.start(t0 + v * 0.012); s.stop(t0 + 1.9); }); }
$('snd').onclick = () => { soundOn = !soundOn; if (soundOn) ensureAudio(); $('snd').textContent = soundOn ? 'Sound on' : 'Sound off'; $('snd').classList.toggle('on', soundOn); };
window.addEventListener('keydown', e => { if (e.key === 'm') $('snd').click(); });

// ---------- drawing: the grid that keeps every symbol on screen
const GAP = 8, LABEL = 12;      // pixels between tiles, and under each for the maker's mark
function fit(n, w, h) { let best = { px: 0, cols: 1 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) { const rws = Math.ceil(n / cols), px = Math.min((w - GAP * (cols - 1)) / (cols * W), (h - (GAP + LABEL) * rws) / (rws * H)); if (px > best.px) best = { px, cols }; }
  return best; }
function frame() { const dpr = window.devicePixelRatio || 1, st = $('stage'), w = st.clientWidth, h = st.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = CLOTH; g.fillRect(0, 0, w, h);
  const n = wall.length, now = Date.now();
  if (!n) { g.fillStyle = INK; g.globalAlpha = 0.6; g.font = '20px -apple-system, Helvetica, sans-serif'; g.textAlign = 'center'; g.fillText('The wall is empty. Scan the code and draw one symbol.', w / 2, h / 2); g.globalAlpha = 1; }
  else { const f = fit(Math.max(n, 6), w - 24, h - 24), px = Math.max(1, Math.min(12, Math.floor(f.px * 2) / 2)), gap = GAP, tw = W * px, th = H * px, cols = f.cols;
    const x0 = (w - (cols * (tw + gap) - gap)) / 2, y0 = 14;
    wall.forEach((s, i) => { const x = x0 + (i % cols) * (tw + gap), y = y0 + Math.floor(i / cols) * (th + GAP + LABEL), age = now - s.born, shown = s.born ? Math.min(H, Math.floor(age / FORM_MS * H) + 1) : H;
      g.fillStyle = TILE; g.fillRect(x, y, tw, th); g.fillStyle = INK; const cell = Math.max(1, px - (px >= 4 ? 1 : 0));
      for (let r = 0; r < shown; r++) { const row = s.rows[r]; for (let c = 0; c < W; c++) if (row[c] === '#') g.fillRect(x + c * px, y + r * px, cell, cell); }
      if (s.born && shown < H) { g.fillStyle = 'rgba(179,38,30,.8)'; g.fillRect(x, y + shown * px, tw, Math.max(1, px / 3)); if (s.said !== shown) { s.said = shown; strum(s.rows[shown - 1], shown); $('now').textContent = `${s.by || ''} is forming`; } }
      else if (s.born && !s.done) { s.done = true; $('now').textContent = ''; }
      g.fillStyle = INK; g.globalAlpha = 0.55; g.font = '9px -apple-system, Helvetica, sans-serif'; g.textAlign = 'left'; g.fillText(s.by || '', x, y + th + 10); g.globalAlpha = 1; }); }
  requestAnimationFrame(frame); }
poll(); setInterval(poll, 2000); requestAnimationFrame(frame);
