// Tiny WebAudio synth: chiptune SFX + per-biome generative music loop (muffled "underwater").
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// [root midi, scale intervals, chord degrees per bar, bpm]
const SONGS = [
  { root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 2], bpm: 112, lead: 'square' }, // coral: major pentatonic
  { root: 57, scale: [0, 3, 5, 7, 10], prog: [0, 2, 3, 1], bpm: 100, lead: 'triangle' }, // kelp
  { root: 55, scale: [0, 2, 3, 7, 8], prog: [0, 4, 3, 2], bpm: 92, lead: 'square' }, // wreck
  { root: 62, scale: [0, 2, 4, 6, 9], prog: [0, 1, 4, 3], bpm: 104, lead: 'triangle' }, // crystal (lydian-ish)
  { root: 59, scale: [0, 2, 3, 7, 9], prog: [0, 3, 1, 4], bpm: 96, lead: 'triangle' }, // ice
  { root: 52, scale: [0, 1, 4, 5, 7], prog: [0, 1, 0, 4], bpm: 120, lead: 'sawtooth' }, // volcanic (phrygian dom.)
  { root: 54, scale: [0, 2, 3, 7, 8], prog: [0, 3, 2, 4], bpm: 98, lead: 'square' }, // temple
  { root: 50, scale: [0, 1, 3, 7, 8], prog: [0, 4, 1, 3], bpm: 84, lead: 'triangle' }, // abyss
  { root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 4, 3, 4], bpm: 126, lead: 'square' }, // title
  { root: 58, scale: [0, 2, 3, 7, 10], prog: [0, 3, 4, 1], bpm: 108, lead: 'triangle' }, // 9: neon atlantis
  { root: 49, scale: [0, 1, 3, 6, 7], prog: [0, 1, 4, 1], bpm: 96, lead: 'sawtooth' }, // 10: toxic trench
  { root: 53, scale: [0, 3, 5, 7, 10], prog: [0, 0, 3, 4], bpm: 132, lead: 'square' }, // 11: submarine base
  { root: 45, scale: [0, 1, 3, 5, 8], prog: [0, 4, 1, 3], bpm: 140, lead: 'sawtooth' }, // 12: boss fight
];

// song index for a biome (title music sits at index 8)
export const songFor = (biome, boss) => (boss ? 12 : biome >= 8 ? biome + 1 : biome);

export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.song = -1;
    this.step = 0;
    this.nextT = 0;
    this.timer = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
    this.mus = this.ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.22 : 0;
    this.lp = this.ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 1600;
    this.mus.connect(this.lp); this.lp.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.song >= 0) this.startLoop();
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.mus) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.1);
  }

  tone(f0, f1, dur, type = 'square', vol = 0.3, delay = 0, dest) {
    if (!this.ctx || (!dest && !this.sfxOn)) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.3, freq = 1200, delay = 0, q = 1) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'gem': this.tone(988, 988, 0.06, 'square', 0.18); this.tone(1319, 1319, 0.1, 'square', 0.18, 0.06); break;
      case 'chest': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.12, 'square', 0.16, i * 0.07)); break;
      case 'key': this.tone(1568, 1568, 0.05, 'square', 0.15); this.tone(2093, 2093, 0.12, 'triangle', 0.2, 0.05); break;
      case 'door': this.tone(220, 110, 0.25, 'sawtooth', 0.15); this.noise(0.3, 0.25, 400); break;
      case 'dash': this.noise(0.18, 0.25, 1800, 0, 0.7); this.tone(300, 600, 0.12, 'triangle', 0.1); break;
      case 'hurt': this.tone(400, 90, 0.3, 'square', 0.22); this.noise(0.2, 0.25, 600); break;
      case 'kill': this.tone(660, 1320, 0.08, 'square', 0.15); this.noise(0.12, 0.2, 2500); break;
      case 'break': this.noise(0.35, 0.4, 300, 0, 0.6); this.tone(150, 60, 0.25, 'square', 0.12); break;
      case 'boom': this.noise(0.6, 0.5, 180, 0, 0.5); this.tone(120, 40, 0.5, 'sawtooth', 0.2); break;
      case 'bubble': this.tone(500 + Math.random() * 300, 1400, 0.07, 'sine', 0.12); break;
      case 'air': this.tone(300, 900, 0.18, 'sine', 0.15); break;
      case 'low': this.tone(880, 880, 0.08, 'square', 0.12); this.tone(660, 660, 0.08, 'square', 0.12, 0.1); break;
      case 'open': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.2, i * 0.08)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.16, 'square', 0.14, i * 0.09)); break;
      case 'lose': [392, 349, 311, 262, 196].forEach((f, i) => this.tone(f, f * 0.98, 0.22, 'triangle', 0.22, i * 0.16)); break;
      case 'click': this.tone(880, 880, 0.03, 'square', 0.1); break;
      case 'select': this.tone(660, 990, 0.08, 'square', 0.12); break;
      case 'pearl': this.tone(1200, 600, 0.08, 'triangle', 0.12); break;
      case 'bounce': this.tone(180, 120, 0.06, 'triangle', 0.12); break;
      case 'roar': this.noise(0.9, 0.4, 120, 0, 0.4); this.tone(90, 45, 0.9, 'sawtooth', 0.18); break;
      case 'crack': this.noise(0.2, 0.2, 900); break;
    }
  }

  music(idx) {
    if (this.song === idx) return;
    this.song = idx;
    this.step = 0;
    if (this.ctx) this.startLoop();
  }

  startLoop() {
    clearInterval(this.timer);
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  schedule() {
    if (!this.ctx || this.song < 0) return;
    const S = SONGS[this.song];
    const st = 60 / S.bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.2) {
      const s = this.step % 64, bar = Math.floor(s / 16), beat = s % 16;
      const deg = S.prog[bar];
      const sc = (k) => {
        const n = S.scale.length;
        const o = Math.floor(k / n);
        return S.root + S.scale[((k % n) + n) % n] + 12 * o;
      };
      const t = this.nextT - this.ctx.currentTime;
      if (this.musicOn) {
        if (beat % 4 === 0) this.tone(NOTE(sc(deg) - 24), NOTE(sc(deg) - 24), st * 3.2, 'triangle', 0.5, t, this.mus);
        if (beat % 8 === 6) this.tone(NOTE(sc(deg + 2) - 24), NOTE(sc(deg + 2) - 24), st * 1.5, 'triangle', 0.35, t, this.mus);
        const arp = [0, 2, 4, 2, 5, 4, 2, 4];
        if (beat % 2 === 0) {
          const k = deg + arp[(beat / 2 + bar) % arp.length];
          this.tone(NOTE(sc(k)), NOTE(sc(k)), st * 1.6, S.lead, 0.12, t, this.mus);
        }
        if (beat === 0 && bar % 2 === 0) this.tone(NOTE(sc(deg + 4) + 12), NOTE(sc(deg + 4) + 12), st * 6, 'triangle', 0.14, t, this.mus);
      }
      this.nextT += st;
      this.step++;
    }
  }
}
