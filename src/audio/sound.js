/**
 * Son : tout est synthétisé avec WebAudio, aucun fichier audio.
 */
import { clamp } from '../sim/constants.js';

const Sound = {
  ctx: null, master: null, crowd: null, muted: false, noise: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ctx = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.connect(ac.destination);
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(comp);
    // bruit blanc réutilisable
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; ch[i] = w * 0.5 + last * 3; }
    this.noise = buf;
    // brouhaha de la foule : bruit filtré en boucle, volume piloté par l'excitation
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    this.crowd = ac.createGain(); this.crowd.gain.value = 0;
    src.connect(bp); bp.connect(lp); lp.connect(this.crowd); this.crowd.connect(this.master);
    src.start();
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  },
  ok() { return this.ctx && this.ctx.state === 'running' && !this.muted; },
  env(node, t, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  },
  noiseHit(t, { f = 800, q = 1, type = 'lowpass', vol = 0.3, dec = 0.15, f2 = null }) {
    const ac = this.ctx, s = ac.createBufferSource(); s.buffer = this.noise;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dec);
    const g = ac.createGain(); this.env(g, t, 0.004, vol, dec);
    s.connect(fl); fl.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 1.5); s.stop(t + dec + 0.05);
  },
  tone(t, { f = 200, f2 = null, type = 'sine', vol = 0.3, dec = 0.3, a = 0.004 }) {
    const ac = this.ctx, o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dec * 0.6);
    const g = ac.createGain(); this.env(g, t, a, vol, dec);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dec + 0.05);
  },
  taiko(delay = 0, pitch = 80, vol = 0.6) {
    if (!this.ok()) return; const t = this.ctx.currentTime + delay;
    this.tone(t, { f: pitch * 1.9, f2: pitch, vol, dec: 0.55 });
    this.noiseHit(t, { f: 900, vol: vol * 0.35, dec: 0.06 });
  },
  hyoshigi(delay = 0) {            // claquoirs en bois du gyōji
    if (!this.ok()) return; const t = this.ctx.currentTime + delay;
    this.noiseHit(t, { type: 'bandpass', f: 2300, q: 9, vol: 0.9, dec: 0.07 });
    this.tone(t, { f: 1750, type: 'triangle', vol: 0.18, dec: 0.06 });
  },
  whoosh(vol = 0.25) {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    this.noiseHit(t, { type: 'bandpass', f: 380, f2: 1800, q: 1.2, vol, dec: 0.22 });
  },
  hit(force) {
    if (!this.ok()) return; const t = this.ctx.currentTime, k = clamp(force / 900, 0.1, 1);
    this.noiseHit(t, { f: 250 + 900 * k, vol: 0.25 + 0.55 * k, dec: 0.08 + 0.12 * k });
    this.tone(t, { f: 95, f2: 50, vol: 0.2 + 0.5 * k, dec: 0.18 });
  },
  block() {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    this.tone(t, { f: 980, type: 'triangle', vol: 0.22, dec: 0.25 });
    this.tone(t, { f: 1470, type: 'sine', vol: 0.1, dec: 0.2 });
  },
  thud() { this.taiko(0, 52, 0.9); },
  roll() { [0, 0.22, 0.4, 0.54, 0.65, 0.74, 0.82].forEach((d, i) => this.taiko(d, 70 + (i === 6 ? -12 : 0), i === 6 ? 0.9 : 0.45)); },
  creak() {                       // paille qui craque sous les talons
    if (!this.ok()) return; const t = this.ctx.currentTime;
    this.noiseHit(t, { type: 'bandpass', f: 320, q: 5, vol: 0.35, dec: 0.12 });
    this.noiseHit(t + 0.05, { type: 'bandpass', f: 520, q: 7, vol: 0.18, dec: 0.08 });
  },
  slip() { if (!this.ok()) return; this.noiseHit(this.ctx.currentTime, { type: 'bandpass', f: 900, f2: 300, q: 2, vol: 0.3, dec: 0.25 }); },
  boo() {                         // la foule siffle et grogne (henka)
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, { type: 'bandpass', f: 260, f2: 180, q: 3, vol: 0.35, dec: 0.9 });
    this.noiseHit(t + 0.15, { type: 'bandpass', f: 220, f2: 150, q: 4, vol: 0.25, dec: 0.8 });
    this.tone(t + 0.05, { f: 1900, f2: 1500, type: 'sine', vol: 0.03, dec: 0.35, a: 0.05 });   // un sifflet
  },
  click() { if (!this.ok()) return; this.tone(this.ctx.currentTime, { f: 700, type: 'triangle', vol: 0.08, dec: 0.05 }); },
  buzz() { if (!this.ok()) return; const t = this.ctx.currentTime; this.tone(t, { f: 140, type: 'square', vol: 0.08, dec: 0.25 }); this.hyoshigi(0.08); },
  crowdLevel(x) { if (this.crowd) this.crowd.gain.setTargetAtTime(x, this.ctx.currentTime, 0.25); },
};

export { Sound };
