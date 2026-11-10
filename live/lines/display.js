/* The common display as a record, after the Ornament Table Sequencer, in two columns: the composed
 * ornament on the left, every control on the right. The ornament is turned as on the phones: every line
 * anyone sent runs across, 23 cells wide, and the band moves upward past a fixed horizon in the middle
 * of the screen, like paper out of the printer; history is above the horizon, the lines still to come
 * below it. One line crosses per eighth note at the tempo, with swing, and sounds on four synthesised folk
 * voices (see the sound section), rows pitched in a Dorian mode, low at the bottom. When the band has been played through, two blank
 * lines pass and it comes round again, so the record never stops; lines sent meanwhile join the end.
 * A line that is exactly one of the dictionary's is drawn in soot, a line someone made in madder red,
 * so the question "whose is it?" can be asked of the record. Form only.
 * Keys: space play/pause · m sound · , . tempo · [ ] swing.
 */
'use strict';
const H = 23, GAP = 2, KEEP = 600;
const BAND = 'https://ornament-rows.netlify.app/.netlify/functions/ends';
// the band's API is beside the page on Netlify and on the laptop relay; any other host uses Netlify's
const API = /github\.io$/.test(location.hostname) ? BAND : '/.netlify/functions/ends';
const CLOTH = [239, 230, 214], INK = [52, 40, 24], MADE = [179, 38, 30];
let shared = [], lastT = 0, netN = 0, netMsg = '', joinAt = location.host + location.pathname.replace(/display\.html$/, '');
let tape = [];            // columns that have crossed the horizon, oldest first: { row, by, exact } or null (blank)
let ni = 0, rest = 0;     // next band line to cross; blank columns left in the rest between passes
let playing = false, soundOn = false, bpm = 96, swing = 0.12, stepN = 0, tickAt = 0, tickLen = 0.3, timer = null;
const audio = { ctx: null, out: null };

function lines() { const out = []; for (const e of shared) e.rows.forEach((r, i) => { if (r.includes('#')) out.push({ row: r, by: e.by, exact: e.ex ? !!e.ex[i] : !!e.exact }); }); return out; }
async function poll() { try { const r = await fetch(`${API}?since=${lastT}`, { cache: 'no-store' }); const j = await r.json();
    if (j.join) joinAt = j.join;      // the laptop relay names the address phones can reach
    if (j.ends) for (const e of j.ends) if (!shared.some(s => (s.id || s.t) === (e.id || e.t))) shared.push(e);
    if (shared.length) { shared.sort((a, b) => a.t - b.t); lastT = shared[shared.length - 1].t; }
    if (j.n === 0 && shared.length) { shared = []; lastT = 0; ni = 0; }
    netN = lines().length; netMsg = `${netN} line${netN === 1 ? '' : 's'} on the band`; } catch (e) { netMsg = 'band unreachable'; }
  document.getElementById('net').textContent = netMsg + ' · '; document.getElementById('addr').textContent = joinAt; drawQR(); }
// the join code: the same address as a QR, redrawn only when the address changes; a click enlarges it
let qrFor = '';
function drawQR() { const el = document.getElementById('qr'), url = (/^https?:/.test(joinAt) ? '' : location.protocol + '//') + joinAt;
  if (!window.QRCode) { el.style.display = 'none'; return; } if (url === qrFor) return; qrFor = url; el.innerHTML = '';
  new QRCode(el, { text: url, width: 480, height: 480, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  el.onclick = () => el.classList.toggle('big'); }

// ---------- sound: four synthesised folk voices (approximations, no recordings)
//   цымбалы  hammered dulcimer: every inked cell, a struck pair of strings (Karplus–Strong), strummed up or down
//   жалейка  reed pipe: the highest cell of a line someone made, with a grace note from below and a late vibrato
//   дуда     bagpipe drone: tonic and fifth, held under everything
//   бубен    frame drum: a thump on the beat, jingles off it
// The 23 cells of a line are pitched in a Dorian mode on D, low at the left, like the courses of the
// dulcimer: a little over three octaves; each cell also sounds from its own place between the speakers.
const MODE = [0, 2, 3, 5, 7, 9, 10], TONIC = 146.83;
const rowHz = i => { const k = i; return TONIC * Math.pow(2, (12 * Math.floor(k / 7) + MODE[k % 7]) / 12); };
const voices = { tsymbaly: true, zhaleyka: true, duda: true, buben: true };
const strings = new Map(); let drone = null, lastPipe = 0;
function ensureAudio() { if (!audio.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; const c = audio.ctx = new AC();
    audio.out = c.createGain(); audio.out.gain.value = 0.8;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    // a small wooden room: a generated impulse, 1.4 s
    const ir = c.createBuffer(2, Math.floor(c.sampleRate * 1.4), c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    const rev = c.createConvolver(); rev.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.22;
    audio.out.connect(comp); audio.out.connect(rev); rev.connect(wet); wet.connect(comp); comp.connect(c.destination); }
  if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); return true; }
// one struck course of the dulcimer: two strings a few cents apart, hammer noise shaped by where it strikes
function stringBuffer(f) { const key = Math.round(f * 10); if (strings.has(key)) return strings.get(key);
  const sr = audio.ctx.sampleRate, len = Math.floor(sr * 1.8), buf = audio.ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
  for (const det of [1, 1.0035]) { const N = Math.max(2, Math.round(sr / (f * det))), y = new Float32Array(len), damp = 0.9965 - Math.min(0.004, f / 400000);
    let prev = 0; for (let i = 0; i < N; i++) { const n = Math.random() * 2 - 1; prev = 0.55 * n + 0.45 * prev; y[i] = prev * (1 - 0.6 * Math.cos(2 * Math.PI * i / N * 3)); }
    for (let i = N; i < len; i++) y[i] = damp * 0.5 * (y[i - N] + y[i - N + 1 < i ? i - N + 1 : i - N]);
    for (let i = 0; i < len; i++) out[i] += y[i] * 0.5; }
  strings.set(key, buf); return buf; }
function strike(f, gain, t, pan) { const c = audio.ctx, s = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
  s.buffer = stringBuffer(f); g.gain.setValueAtTime(gain, t); g.gain.setTargetAtTime(0.0001, t + 1.1, 0.25);
  s.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(audio.out); } else g.connect(audio.out); s.start(t); s.stop(t + 1.8); }
function pipe(f, t, len) { const c = audio.ctx; while (f < 290) f *= 2; while (f > 900) f /= 2;
  const o1 = c.createOscillator(), o2 = c.createOscillator(), bp = c.createBiquadFilter(), hp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 2.2; hp.type = 'highpass'; hp.frequency.value = 380;
  const from = lastPipe && Math.abs(Math.log2(f / lastPipe)) < 0.5 ? lastPipe : f * Math.pow(2, -2 / 12);       // slide from the last note, or a grace note from below
  for (const o of [o1, o2]) { o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.045); }
  lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(len, 0.25)); lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  const m2 = c.createGain(); m2.gain.value = 0.45; o1.connect(bp); o2.connect(m2); m2.connect(bp); bp.connect(hp); hp.connect(g); g.connect(audio.out);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085, t + 0.03); g.gain.setValueAtTime(0.075, t + len * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.06);
  for (const o of [o1, o2, lfo]) { o.start(t); o.stop(t + len + 0.1); } lastPipe = f; }
function drum(t, accent) { const c = audio.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(accent ? 120 : 96, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
  g.gain.setValueAtTime(accent ? 0.34 : 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(audio.out); o.start(t); o.stop(t + 0.22); noise(t, 0.05, accent ? 0.07 : 0.04, 900, 'lowpass'); }
function noise(t, len, gain, freq, type) { const c = audio.ctx, n = Math.floor(c.sampleRate * len), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.value = gain; s.connect(f); f.connect(g); g.connect(audio.out); s.start(t); }
function setDrone(on) { const c = audio.ctx; if (!c) return;
  if (on && !drone) { const g = c.createGain(), lp = c.createBiquadFilter(), w = c.createOscillator(), wg = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 1.4;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1.5);
    const os = [[TONIC / 2, 0], [TONIC / 2, 7], [TONIC * 0.75, -4], [TONIC, 3]].map(([f, cents]) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents; o.connect(lp); o.start(); return o; });
    w.frequency.value = 0.23; wg.gain.value = 0.012; w.connect(wg); wg.connect(g.gain); w.start(); lp.connect(g); g.connect(audio.out); drone = { g, os: [...os, w] }; }
  if (!on && drone) { const d = drone; drone = null; d.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.3); setTimeout(() => d.os.forEach(o => { try { o.stop(); } catch (e) {} }), 1500); } }
function syncDrone() { if (audio.ctx) setDrone(soundOn && playing && voices.duda); }
function sound(col) { if (!soundOn || !audio.ctx) return; const t0 = audio.ctx.currentTime + 0.02;
  if (voices.buben) { if (stepN % 4 === 0) drum(t0, stepN % 16 === 0); else if (stepN % 4 === 2) noise(t0, 0.035, 0.03, 6500, 'highpass'); }
  if (!col) return; const on = []; [...col.row].forEach((c, i) => { if (c === '#') on.push(i); }); if (!on.length) return;
  if (voices.tsymbaly) { const order = stepN % 2 ? on.slice() : on.slice().reverse(), base = Math.min(0.2, 0.62 / Math.sqrt(on.length)), gap = Math.min(0.022, tickLen * 0.5 / on.length);
    order.forEach((i, v) => strike(rowHz(i), base * (0.8 + Math.random() * 0.4) * (i === on[on.length - 1] ? 1.25 : 1) * (col.exact ? 1 : 0.7), t0 + v * gap + Math.random() * 0.004, (i / (H - 1)) * 1.2 - 0.6)); }
  if (voices.zhaleyka && !col.exact) pipe(rowHz(on[on.length - 1]), t0, tickLen * 0.92); }

// ---------- the clock: one column per eighth, swung
function nextColumn() { const L = lines(); if (!L.length) return null;
  if (rest > 0) { rest--; return null; }
  if (ni >= L.length) { ni = 0; rest = GAP - 1; return null; }
  return L[ni++]; }
function tick() { if (!playing) return; const col = nextColumn(); tape.push(col); if (tape.length > KEEP) tape.shift();
  const b = 60 / bpm / 2; tickLen = stepN % 2 === 0 ? b * (1 + swing) : b * (1 - swing); sound(col); stepN++; tickAt = performance.now();
  document.getElementById('now').textContent = col ? `${col.by || ''} · ${col.exact ? 'a line of the dictionary' : 'made'}` : '';
  timer = setTimeout(tick, tickLen * 1000); }
function setPlaying(v) { playing = v; clearTimeout(timer); document.getElementById('play').textContent = v ? 'Pause' : 'Play'; document.getElementById('play').classList.toggle('on', v);
  if (v) { if (soundOn) ensureAudio(); tick(); } syncDrone(); }
function setSound(v) { soundOn = v; if (v) ensureAudio(); const b = document.getElementById('snd'); b.textContent = v ? 'Sound on' : 'Sound off'; b.classList.toggle('on', v); syncDrone(); }
function upcoming(n) { const L = lines(), out = []; if (!L.length) return out; let i = ni, r = rest;
  while (out.length < n) { if (r > 0) { r--; out.push(null); } else if (i >= L.length) { i = 0; r = GAP - 1; out.push(null); } else out.push(L[i++]); } return out; }

// ---------- drawing
function setup() { const st = document.getElementById('stage'); const cv = createCanvas(st.clientWidth, st.clientHeight); cv.parent('stage');
  document.getElementById('play').onclick = () => setPlaying(!playing);
  document.getElementById('snd').onclick = () => setSound(!soundOn);
  document.querySelectorAll('#voices button').forEach(b => { b.onclick = () => { voices[b.dataset.v] = !voices[b.dataset.v]; b.classList.toggle('on', voices[b.dataset.v]); syncDrone(); }; });
  document.getElementById('bpm').oninput = e => { bpm = +e.target.value; document.getElementById('bpm-out').textContent = bpm; };
  document.getElementById('swing').oninput = e => { swing = +e.target.value; document.getElementById('swing-out').textContent = Math.round(swing * 100) + '%'; };
  poll().then(() => setPlaying(true)); setInterval(poll, 2000); }
function windowResized() { const st = document.getElementById('stage'); resizeCanvas(st.clientWidth, st.clientHeight); }
function keyPressed() { const k = window.key;
  if (k === ' ') { setPlaying(!playing); return false; } if (k === 'm') { setSound(!soundOn); return false; }
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.oninput({ target: el }); };
  if (k === ',') set('bpm', Math.max(40, bpm - 4)); if (k === '.') set('bpm', Math.min(200, bpm + 4));
  if (k === '[') set('swing', Math.max(0, swing - 0.02).toFixed(2)); if (k === ']') set('swing', Math.min(0.5, swing + 0.02).toFixed(2)); }
function rowOfCells(col, y, cw, ch, left, alpha) { if (!col) return; const c = col.exact ? INK : MADE; fill(c[0], c[1], c[2], alpha);
  for (let i = 0; i < H; i++) if (col.row[i] === '#') rect(left + i * cw + 1, y + 1, cw - 2, ch - 2, 1); }
function draw() {
  background(CLOTH[0], CLOTH[1], CLOTH[2]);
  const cw = Math.max(8, Math.min(Math.floor((width - 60) / H), Math.floor(height / 30))), ch = cw, left = Math.floor((width - cw * H) / 2), yh = Math.floor(height / 2);
  // faint ground: the cell columns and the middle column
  stroke(INK[0], INK[1], INK[2], 22); strokeWeight(1); for (let i = 0; i <= H; i++) line(left + i * cw, 0, left + i * cw, height);
  stroke(INK[0], INK[1], INK[2], 60); line(left + (H / 2) * cw, 0, left + (H / 2) * cw, height); noStroke();
  // the record slides one line per tick; frac is how far the next line has come
  const frac = playing ? Math.min(1, (performance.now() - tickAt) / (tickLen * 1000)) : 0, off = frac * ch;
  for (let j = 0; j < tape.length; j++) { const y = yh - (j + 1) * ch - off; if (y < -ch) break; rowOfCells(tape[tape.length - 1 - j], y, cw, ch, left, 255); }
  upcoming(Math.ceil((height - yh) / ch) + 2).forEach((col, j) => rowOfCells(col, yh + j * ch - off, cw, ch, left, 90));
  // the horizon: now
  stroke(INK[0], INK[1], INK[2], 220); strokeWeight(2); line(0, yh, width, yh); noStroke(); fill(INK[0], INK[1], INK[2], 230);
  triangle(0, yh - 6, 0, yh + 6, 8, yh); triangle(width, yh - 6, width, yh + 6, width - 8, yh);
  if (!lines().length) { fill(INK[0], INK[1], INK[2], 150); textAlign(CENTER, CENTER); textSize(18); text(`No lines yet. Join at ${joinAt}`, width / 2, yh - ch * 3); }
}
