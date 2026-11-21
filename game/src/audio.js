// Every sound in Neon Tide is synthesised with WebAudio — no audio files.
// A tiny engine: an engine hum whose pitch follows the car's speed, a police
// siren that fades with distance, one-shot blips for shots, hits, pickups and
// mission jingles, and a slow marimba arpeggio that loops as the city's music.
// The context is created lazily on the first user gesture; until then (and in
// screenshot scenes) every call is a safe no-op.

const SCALE = [0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3]; // minor pentatonic walk
const BASE_HZ = 196; // G3

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.started = false;
  }

  /** Create the context and the looping voices. Call from a click or keypress. */
  ensure() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    this.started = true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // Engine: two detuned saws through a lowpass, gain driven per frame.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();

      // Siren: a square wave whose pitch an LFO sweeps between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 820;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'sine';
      this.sirenLfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 130;
      this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      const sirenFilter = this.ctx.createBiquadFilter();
      sirenFilter.type = 'lowpass';
      sirenFilter.frequency.value = 1600;
      this.sirenOsc.connect(sirenFilter).connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } catch {
      this.ctx = null;
    }
  }

  /** Per-frame: engine pitch/gain from the driven car, siren level, and the music scheduler. */
  update(dt, { driving = false, speed01 = 0, siren01 = 0, music = true } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) {
      const target = driving ? 0.05 + speed01 * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.08);
      this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, t, 0.06);
    }
    if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(siren01 * 0.028, t, 0.15);
    if (music) {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = 0.42;
        const note = SCALE[this.musicStep % SCALE.length];
        this.musicStep += 1;
        this.tone(BASE_HZ * Math.pow(2, note / 12), 0.34, 'triangle', 0.045);
        if (this.musicStep % 4 === 0) this.tone(BASE_HZ / 2, 1.4, 'sine', 0.05);
      }
    }
  }

  /** One short tone with an exponential decay. */
  tone(freq, dur, type = 'square', vol = 0.08, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* a failed blip must never break the game */ }
  }

  /** A burst of filtered noise: gunshots, impacts, splashes of static. */
  noise(dur, vol = 0.12, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t0);
    } catch { /* ignore */ }
  }

  shot() { this.noise(0.09, 0.16, 2600); this.tone(190, 0.08, 'square', 0.07, 60); }
  dryFire() { this.tone(1200, 0.03, 'square', 0.03); }
  hit() { this.noise(0.06, 0.1, 700); }
  crash(intensity = 1) { this.noise(0.22, 0.14 * intensity, 500); this.tone(70, 0.2, 'sine', 0.1, 40); }
  pickup() { this.tone(880, 0.09, 'square', 0.06); this.tone(1318, 0.12, 'square', 0.06, null, 0.07); }
  cash() { this.tone(1568, 0.07, 'square', 0.05); this.tone(2093, 0.1, 'square', 0.05, null, 0.05); }
  door() { this.tone(220, 0.07, 'square', 0.05, 140); this.noise(0.05, 0.05, 900, 0.02); }
  complete() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.09, null, i * 0.11)); }
  fail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.08, null, i * 0.13)); }
  ui() { this.tone(660, 0.05, 'square', 0.04); }
  horn() { this.tone(370, 0.28, 'square', 0.05); this.tone(466, 0.28, 'square', 0.04); }
}
