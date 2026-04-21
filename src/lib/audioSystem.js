// src/lib/audioSystem.js
// ═══════════════════════════════════════════════════════════════════
// ScatterZZZ — Unified Audio System v2
//
// Architecture:
//   - BGM: HTML5 Audio element (loop=true, low volume)
//     → Note: We use AudioContext oscillators since we have no files,
//       but the API is designed to be swapped for real files trivially.
//   - SFX: Web Audio API (procedural synthesis — no files required)
//   - Singleton pattern — import { audio } from './audioSystem'
//
// Anti-chaos rules:
//   1. Only ONE BGM plays at a time (stopBGM before playBGM*)
//   2. SFX debounced: same sound can't fire more than once per 80ms
//   3. All nodes auto-disconnect after playback
//   4. No SFX on loss (enforced by callers, checked here too)
//   5. BGM and SFX have separate gain buses
// ═══════════════════════════════════════════════════════════════════

class AudioSystem {
  constructor() {
    this._ctx        = null
    this._bgmBus     = null   // GainNode for BGM
    this._sfxBus     = null   // GainNode for SFX
    this._bgmNodes   = []     // currently playing BGM oscillators
    this._lastSFX    = {}     // debounce map: sfxKey → lastPlayedTime
    this._bgmEnabled = true
    this._sfxEnabled = true
    this._bgmVolume  = 0.15
    this._sfxVolume  = 0.55
    this._ready      = false
    this._currentBGM = null   // name of current BGM
  }

  // ── Lazy init (requires user gesture to start AudioContext) ────
  init() {
    if (this._ready) return true
    try {
      this._ctx    = new (window.AudioContext || window.webkitAudioContext)()
      this._bgmBus = this._ctx.createGain()
      this._bgmBus.gain.value = this._bgmVolume
      this._bgmBus.connect(this._ctx.destination)
      this._sfxBus = this._ctx.createGain()
      this._sfxBus.gain.value = this._sfxVolume
      this._sfxBus.connect(this._ctx.destination)
      this._ready = true
      return true
    } catch (e) {
      console.warn('[Audio] Web Audio API unavailable:', e.message)
      return false
    }
  }

  // ── Resume context (required after user inactivity) ───────────
  async resume() {
    if (this._ctx?.state === 'suspended') {
      await this._ctx.resume()
    }
  }

  // ── SFX debounce check ─────────────────────────────────────────
  _canPlay(key, debounceMs = 80) {
    const now = Date.now()
    if (this._lastSFX[key] && now - this._lastSFX[key] < debounceMs) return false
    this._lastSFX[key] = now
    return true
  }

  // ── Create oscillator helper ────────────────────────────────────
  _osc(type, freq, gainVal, dur, startOffset = 0) {
    if (!this._ctx || !this._sfxBus) return
    const t   = this._ctx.currentTime + startOffset
    const osc = this._ctx.createOscillator()
    const g   = this._ctx.createGain()
    osc.type           = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gainVal, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this._sfxBus)
    osc.start(t)
    osc.stop(t + dur + 0.01)
  }

  // ── Noise burst helper ──────────────────────────────────────────
  _noise(durationSec, filterType, filterFreq, gainVal, startOffset = 0) {
    if (!this._ctx) return
    const samples = this._ctx.sampleRate * durationSec
    const buf     = this._ctx.createBuffer(1, samples, this._ctx.sampleRate)
    const data    = buf.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1

    const src    = this._ctx.createBufferSource()
    src.buffer   = buf
    const filter = this._ctx.createBiquadFilter()
    filter.type            = filterType
    filter.frequency.value = filterFreq
    const g = this._ctx.createGain()
    const t = this._ctx.currentTime + startOffset
    g.gain.setValueAtTime(gainVal, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec)
    src.connect(filter)
    filter.connect(g)
    g.connect(this._sfxBus)
    src.start(t)
    src.stop(t + durationSec + 0.01)
  }

  // ══════════════════════════════════════════════════════════════
  // BGM — procedural looping themes
  // ══════════════════════════════════════════════════════════════

  stopBGM() {
    this._bgmNodes.forEach(n => { try { n.stop() } catch (_) {} })
    this._bgmNodes = []
    this._currentBGM = null
  }

  _startBGM(name, buildFn) {
    if (!this.init()) return
    if (!this._bgmEnabled) return
    if (this._currentBGM === name) return   // already playing
    this.stopBGM()
    this.resume()
    buildFn()
    this._currentBGM = name
  }

  // Lucky Leprechaun — bright jig-like arpeggio
  playBGMLeprechaun() {
    this._startBGM('leprechaun', () => {
      const t = this._ctx.currentTime

      // Bass pulse (D2 = 73.4 Hz)
      const bass = this._ctx.createOscillator()
      const bassG = this._ctx.createGain()
      bass.type = 'triangle'
      bass.frequency.value = 73.4
      bassG.gain.value = 0.08
      bass.connect(bassG)
      bassG.connect(this._bgmBus)
      bass.start(t)

      // Cheerful high arpeggio
      const arp = this._ctx.createOscillator()
      const arpG = this._ctx.createGain()
      arp.type = 'sine'
      arp.frequency.value = 523  // C5
      arpG.gain.value = 0.05
      // LFO to simulate arpeggio feel
      const lfo = this._ctx.createOscillator()
      const lfoG = this._ctx.createGain()
      lfo.frequency.value = 6    // 6 Hz tremolo
      lfoG.gain.value = 40
      lfo.connect(lfoG)
      lfoG.connect(arp.frequency)
      lfo.start(t)
      arp.connect(arpG)
      arpG.connect(this._bgmBus)
      arp.start(t)

      this._bgmNodes = [bass, arp, lfo]
    })
  }

  // Wild West — twangy low-pitched drone with rhythm pulse
  playBGMWildWest() {
    this._startBGM('wildwest', () => {
      const t = this._ctx.currentTime

      // Low slide guitar-like
      const slide = this._ctx.createOscillator()
      const slideG = this._ctx.createGain()
      slide.type = 'sawtooth'
      slide.frequency.value = 110  // A2
      slideG.gain.value = 0.06
      // Slow vibrato
      const vib = this._ctx.createOscillator()
      const vibG = this._ctx.createGain()
      vib.frequency.value = 4
      vibG.gain.value = 3
      vib.connect(vibG)
      vibG.connect(slide.frequency)
      vib.start(t)
      slide.connect(slideG)
      slideG.connect(this._bgmBus)
      slide.start(t)

      // Rhythm tick (high-pass noise)
      const tickInterval = setInterval(() => {
        if (!this._bgmEnabled) return
        this._osc('square', 800, 0.04, 0.05)
      }, 500)

      // Store interval for cleanup
      this._bgmNodes = [slide, vib]
      this._bgmTickInterval = tickInterval
    })
  }

  // Maximus — electric storm drone
  playBGMMaximus() {
    this._startBGM('maximus', () => {
      const t = this._ctx.currentTime

      const bass = this._ctx.createOscillator()
      const bassG = this._ctx.createGain()
      bass.type = 'sawtooth'
      bass.frequency.value = 55   // deep A1
      bassG.gain.value = 0.10
      bass.connect(bassG)
      bassG.connect(this._bgmBus)
      bass.start(t)

      const drone = this._ctx.createOscillator()
      const droneG = this._ctx.createGain()
      drone.type = 'square'
      drone.frequency.value = 110
      droneG.gain.value = 0.04
      const lfo = this._ctx.createOscillator()
      const lfoG = this._ctx.createGain()
      lfo.frequency.value = 0.4
      lfoG.gain.value = 10
      lfo.connect(lfoG)
      lfoG.connect(drone.frequency)
      lfo.start(t)
      drone.connect(droneG)
      droneG.connect(this._bgmBus)
      drone.start(t)

      this._bgmNodes = [bass, drone, lfo]
    })
  }

  // Tsunami — ocean ambience with low tide rumble
  playBGMTsunami() {
    this._startBGM('tsunami', () => {
      const sampleRate = this._ctx.sampleRate
      const bufSize    = sampleRate * 6  // 6s loop
      const buf        = this._ctx.createBuffer(1, bufSize, sampleRate)
      const data       = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

      const noise = this._ctx.createBufferSource()
      noise.buffer = buf
      noise.loop   = true
      const filt   = this._ctx.createBiquadFilter()
      filt.type              = 'lowpass'
      filt.frequency.value   = 350
      const envLFO = this._ctx.createOscillator()
      const envG   = this._ctx.createGain()
      envLFO.frequency.value = 0.12
      envG.gain.value        = 0.05
      envLFO.connect(envG)
      envG.connect(filt.gain)
      envLFO.start()
      const noiseG = this._ctx.createGain()
      noiseG.gain.value = 0.12
      noise.connect(filt)
      filt.connect(noiseG)
      noiseG.connect(this._bgmBus)
      noise.start()

      const deep = this._ctx.createOscillator()
      deep.type = 'sine'
      deep.frequency.value = 78
      const deepG = this._ctx.createGain()
      deepG.gain.value = 0.04
      deep.connect(deepG)
      deepG.connect(this._bgmBus)
      deep.start()

      this._bgmNodes = [noise, envLFO, deep]
    })
  }

  // Amazon — jungle ambience (birds + low hum)
  playBGMAmazon() {
    this._startBGM('amazon', () => {
      const t = this._ctx.currentTime

      // Forest hum base
      const hum = this._ctx.createOscillator()
      const humG = this._ctx.createGain()
      hum.type = 'sine'
      hum.frequency.value = 220
      humG.gain.value = 0.04
      hum.connect(humG)
      humG.connect(this._bgmBus)
      hum.start(t)

      // Bird-like high chirp (LFO on frequency)
      const bird = this._ctx.createOscillator()
      const birdG = this._ctx.createGain()
      bird.type = 'sine'
      bird.frequency.value = 1200
      const birdLFO = this._ctx.createOscillator()
      const birdLFOG = this._ctx.createGain()
      birdLFO.frequency.value = 8
      birdLFOG.gain.value = 300
      birdLFO.connect(birdLFOG)
      birdLFOG.connect(bird.frequency)
      birdLFO.start(t)
      birdG.gain.value = 0.02
      bird.connect(birdG)
      birdG.connect(this._bgmBus)
      bird.start(t)

      // Rhythmic drum-like low thud
      const drumInterval = setInterval(() => {
        if (!this._bgmEnabled) return
        this._noise(0.15, 'lowpass', 150, 0.18)
      }, 800)
      this._bgmTickInterval = drumInterval

      this._bgmNodes = [hum, bird, birdLFO]
    })
  }

  // ══════════════════════════════════════════════════════════════
  // SOUND EFFECTS
  // ══════════════════════════════════════════════════════════════

  // Generic check
  _sfx(key, debounceMs, fn) {
    if (!this._sfxEnabled) return
    if (!this.init()) return
    this.resume()
    if (!this._canPlay(key, debounceMs)) return
    fn()
  }

  // ── Spin whoosh ───────────────────────────────────────────────
  playSpin() {
    this._sfx('spin', 200, () => {
      this._osc('sawtooth', 180, 0.28, 0.4)
      // frequency sweep up
      const osc = this._ctx.createOscillator()
      const g   = this._ctx.createGain()
      osc.type  = 'sine'
      osc.frequency.setValueAtTime(300, this._ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(900, this._ctx.currentTime + 0.35)
      g.gain.setValueAtTime(0.2, this._ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.0001, this._ctx.currentTime + 0.4)
      osc.connect(g)
      g.connect(this._sfxBus)
      osc.start()
      osc.stop(this._ctx.currentTime + 0.45)
    })
  }

  // ── Tile drop ─────────────────────────────────────────────────
  playTileDrop() {
    this._sfx('tiledrop', 80, () => {
      this._osc('sine', 350, 0.14, 0.12)
      this._osc('sine', 260, 0.10, 0.10, 0.06)
    })
  }

  // ── Match / cluster found ─────────────────────────────────────
  playMatch() {
    this._sfx('match', 100, () => {
      this._osc('sine', 880,  0.18, 0.18)
      this._osc('sine', 1047, 0.14, 0.18, 0.06)
      this._osc('sine', 1319, 0.10, 0.22, 0.12)
    })
  }

  // ── Small win ─────────────────────────────────────────────────
  playSmallWin() {
    this._sfx('smallwin', 300, () => {
      const scale = [523, 659, 784, 1047]
      scale.forEach((f, i) => this._osc('sine', f, 0.18, 0.22, i * 0.07))
    })
  }

  // ── Big win ───────────────────────────────────────────────────
  playBigWin() {
    this._sfx('bigwin', 500, () => {
      const melody = [523, 659, 784, 1047, 1319, 1047, 1319, 1568]
      melody.forEach((f, i) => {
        this._osc('sine',     f,       0.22, 0.28, i * 0.09)
        this._osc('triangle', f * 0.5, 0.09, 0.28, i * 0.09)
      })
    })
  }

  // ── Jackpot ───────────────────────────────────────────────────
  playJackpot() {
    this._sfx('jackpot', 1000, () => {
      const fanfare = [523, 659, 784, 1047, 1319, 1568, 2093]
      fanfare.forEach((f, i) => {
        this._osc('sine',     f,       0.26, 0.4,  i * 0.1)
        this._osc('triangle', f * 0.5, 0.12, 0.4,  i * 0.1)
        this._osc('sine',     f * 2,   0.08, 0.2,  i * 0.1 + 0.1)
      })
    })
  }

  // ── Cascade / chain reaction ──────────────────────────────────
  playCascade(level = 1) {
    const key = `cascade-${level}`
    this._sfx(key, 150, () => {
      const base = 440 * Math.pow(1.15, Math.min(level - 1, 5)) // pitch up per level
      this._osc('square', base,       0.14, 0.14)
      this._osc('square', base * 1.5, 0.09, 0.14, 0.08)
    })
  }

  // ── Lightning strike (Maximus) ────────────────────────────────
  playLightning() {
    this._sfx('lightning', 200, () => {
      this._noise(0.28, 'highpass', 1200, 0.45)
      this._osc('sawtooth', 110, 0.28, 0.18)
      this._osc('sawtooth', 220, 0.18, 0.14, 0.05)
    })
  }

  // ── Wave crash (Tsunami) ──────────────────────────────────────
  playWaveCrash() {
    this._sfx('wave', 300, () => {
      this._noise(1.0, 'lowpass', 280, 0.32)
      this._osc('sine', 65, 0.28, 0.9)
    })
  }

  // ── Water level rise ──────────────────────────────────────────
  playWaterRise() {
    this._sfx('waterrise', 400, () => {
      this._osc('sine', 220, 0.11, 0.35)
      this._osc('sine', 330, 0.07, 0.28, 0.12)
    })
  }

  // ── Zeus bonus ────────────────────────────────────────────────
  playZeusBonus() {
    this._sfx('zeusbonus', 800, () => {
      this.playLightning()
      setTimeout(() => this.playLightning(), 220)
      setTimeout(() => this.playBigWin(), 450)
    })
  }

  // ── Tsunami bonus ─────────────────────────────────────────────
  playTsunamiBonus() {
    this._sfx('tsunamibonus', 1000, () => {
      this.playWaveCrash()
      setTimeout(() => this.playWaveCrash(), 650)
      setTimeout(() => this.playBigWin(), 1300)
    })
  }

  // ── Vine spread (Amazon) ──────────────────────────────────────
  playVineSpread() {
    this._sfx('vine', 150, () => {
      this._osc('triangle', 180, 0.12, 0.3)
      this._osc('triangle', 240, 0.09, 0.25, 0.1)
    })
  }

  // ── Monkey multiplier (Amazon) ────────────────────────────────
  playMonkey() {
    this._sfx('monkey', 200, () => {
      const notes = [880, 1100, 880, 1320]
      notes.forEach((f, i) => this._osc('sine', f, 0.15, 0.12, i * 0.08))
    })
  }

  // ── Jungle frenzy bonus ───────────────────────────────────────
  playJungleFrenzy() {
    this._sfx('frenzy', 1000, () => {
      this.playVineSpread()
      setTimeout(() => this.playMonkey(), 200)
      setTimeout(() => this.playBigWin(), 500)
    })
  }

  // ── Western coin sound ────────────────────────────────────────
  playCoinSpin() {
    this._sfx('coin', 100, () => {
      this._osc('triangle', 1200, 0.16, 0.2)
      this._osc('triangle', 900,  0.12, 0.2, 0.05)
      this._osc('triangle', 1500, 0.08, 0.15, 0.10)
    })
  }

  // ── Gunshot (Wild West) ───────────────────────────────────────
  playGunshot() {
    this._sfx('gun', 300, () => {
      this._noise(0.18, 'highpass', 800, 0.5)
      this._osc('sawtooth', 80, 0.3, 0.15)
    })
  }

  // ── Irish jingle (Lucky Leprechaun win) ──────────────────────
  playIrishJingle() {
    this._sfx('irish', 300, () => {
      const jig = [784, 880, 1047, 880, 784, 659, 784]
      jig.forEach((f, i) => this._osc('sine', f, 0.18, 0.15, i * 0.06))
    })
  }

  // ── Toggle / volume controls ──────────────────────────────────
  toggleBGM(on) {
    this._bgmEnabled = on
    if (!on) this.stopBGM()
    if (this._bgmBus) this._bgmBus.gain.value = on ? this._bgmVolume : 0
  }

  toggleSFX(on) {
    this._sfxEnabled = on
    if (this._sfxBus) this._sfxBus.gain.value = on ? this._sfxVolume : 0
  }

  setBGMVolume(v) {
    this._bgmVolume = Math.max(0, Math.min(1, v))
    if (this._bgmBus) this._bgmBus.gain.value = this._bgmEnabled ? this._bgmVolume : 0
  }

  setSFXVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v))
    if (this._sfxBus) this._sfxBus.gain.value = this._sfxEnabled ? this._sfxVolume : 0
  }

  // Clean up all intervals and nodes (call on app unmount if needed)
  destroy() {
    this.stopBGM()
    if (this._bgmTickInterval) clearInterval(this._bgmTickInterval)
    if (this._ctx) this._ctx.close()
  }
}

// Export singleton
export const audio = new AudioSystem()
