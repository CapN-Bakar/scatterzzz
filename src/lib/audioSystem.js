// src/lib/audioSystem.js
// ─────────────────────────────────────────────────────────────────
// ScatterZZZ Audio System
// Manages background music (BGM) and sound effects (SFX) for all games.
// Uses Web Audio API for SFX (procedural synthesis — no files needed!)
// and HTML5 Audio for BGM (also procedural via AudioContext oscillators).
// ─────────────────────────────────────────────────────────────────

class AudioSystem {
  constructor() {
    this._ctx = null          // AudioContext (lazy-init on first user gesture)
    this._bgmGain = null      // master gain for BGM
    this._sfxGain = null      // master gain for SFX
    this._bgmNodes = []       // oscillator nodes for current BGM
    this._bgmEnabled = true
    this._sfxEnabled = true
    this._initialized = false
  }

  // ── Lazy init (must be triggered by user gesture) ──────────────
  _init() {
    if (this._initialized) return
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)()
      this._bgmGain = this._ctx.createGain()
      this._bgmGain.gain.value = 0.18
      this._bgmGain.connect(this._ctx.destination)

      this._sfxGain = this._ctx.createGain()
      this._sfxGain.gain.value = 0.6
      this._sfxGain.connect(this._ctx.destination)

      this._initialized = true
    } catch (e) {
      console.warn('AudioContext not available:', e)
    }
  }

  // ── Helper: create and connect an oscillator ──────────────────
  _osc(type, freq, gainVal, duration, destination, startTime = 0) {
    if (!this._ctx) return null
    const osc = this._ctx.createOscillator()
    const g = this._ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gainVal, this._ctx.currentTime + startTime)
    g.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + startTime + duration)
    osc.connect(g)
    g.connect(destination || this._sfxGain)
    osc.start(this._ctx.currentTime + startTime)
    osc.stop(this._ctx.currentTime + startTime + duration)
    return osc
  }

  // ── Stop all BGM oscillators ─────────────────────────────────
  stopBGM() {
    this._bgmNodes.forEach(n => {
      try { n.stop() } catch (_) {}
    })
    this._bgmNodes = []
  }

  // ── BGM: Maximus (Zeus / electric storm) ─────────────────────
  // Deep rumbling bass + eerie high synth drone
  playBGMMaximus() {
    this._init()
    if (!this._ctx || !this._bgmEnabled) return
    this.stopBGM()

    const play = () => {
      if (!this._bgmEnabled) return
      const t = this._ctx.currentTime

      // Deep bass rumble
      const bass = this._ctx.createOscillator()
      const bassGain = this._ctx.createGain()
      bass.type = 'sawtooth'
      bass.frequency.value = 55
      bassGain.gain.setValueAtTime(0.12, t)
      bass.connect(bassGain)
      bassGain.connect(this._bgmGain)

      // Mid drone
      const drone = this._ctx.createOscillator()
      const droneGain = this._ctx.createGain()
      drone.type = 'square'
      drone.frequency.value = 110
      droneGain.gain.setValueAtTime(0.04, t)
      // Slow LFO modulation for electric feel
      const lfo = this._ctx.createOscillator()
      const lfoGain = this._ctx.createGain()
      lfo.frequency.value = 0.3
      lfoGain.gain.value = 8
      lfo.connect(lfoGain)
      lfoGain.connect(drone.frequency)
      lfo.start(t)

      drone.connect(droneGain)
      droneGain.connect(this._bgmGain)
      bass.start(t)
      drone.start(t)

      this._bgmNodes = [bass, drone, lfo]
    }
    play()
  }

  // ── BGM: Tsunami (ocean ambience) ────────────────────────────
  // Pink noise ocean waves + low flowing tones
  playBGMTsunami() {
    this._init()
    if (!this._ctx || !this._bgmEnabled) return
    this.stopBGM()

    // White noise buffer (ocean waves)
    const bufferSize = this._ctx.sampleRate * 4
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const noise = this._ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true

    // Filter to make it ocean-like (low-pass)
    const filter = this._ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400

    // Slow volume tremolo (waves crashing)
    const tremoloLFO = this._ctx.createOscillator()
    const tremoloGain = this._ctx.createGain()
    tremoloLFO.frequency.value = 0.15
    tremoloGain.gain.value = 0.06
    tremoloLFO.connect(tremoloGain)
    tremoloGain.connect(filter.gain)
    tremoloLFO.start()

    const noiseGain = this._ctx.createGain()
    noiseGain.gain.value = 0.15

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(this._bgmGain)
    noise.start()

    // Deep ocean tone
    const deep = this._ctx.createOscillator()
    deep.type = 'sine'
    deep.frequency.value = 80
    const deepGain = this._ctx.createGain()
    deepGain.gain.value = 0.05
    deep.connect(deepGain)
    deepGain.connect(this._bgmGain)
    deep.start()

    this._bgmNodes = [noise, tremoloLFO, deep]
  }

  // ══════════════════════════════════════════════════════════════
  // SOUND EFFECTS
  // ══════════════════════════════════════════════════════════════

  // ── Spin start ───────────────────────────────────────────────
  playSpin() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    // Rising whoosh
    const osc = this._ctx.createOscillator()
    const g = this._ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(200, this._ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(800, this._ctx.currentTime + 0.3)
    g.gain.setValueAtTime(0.3, this._ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.4)
    osc.connect(g)
    g.connect(this._sfxGain)
    osc.start()
    osc.stop(this._ctx.currentTime + 0.4)
  }

  // ── Tile drop / fall ─────────────────────────────────────────
  playTileDrop() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    this._osc('sine', 440, 0.15, 0.1)
    this._osc('sine', 330, 0.1, 0.1, null, 0.05)
  }

  // ── Tile match / cluster found ───────────────────────────────
  playMatch() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    // Bright chime
    this._osc('sine', 880, 0.2, 0.2)
    this._osc('sine', 1100, 0.15, 0.2, null, 0.05)
    this._osc('sine', 1320, 0.1, 0.3, null, 0.1)
  }

  // ── Small win ────────────────────────────────────────────────
  playSmallWin() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    const freqs = [523, 659, 784, 1047]
    freqs.forEach((f, i) => this._osc('sine', f, 0.2, 0.25, null, i * 0.07))
  }

  // ── Big win ──────────────────────────────────────────────────
  playBigWin() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    const melody = [523, 659, 784, 1047, 1319, 1047, 1319, 1568]
    melody.forEach((f, i) => {
      this._osc('sine', f, 0.25, 0.3, null, i * 0.08)
      this._osc('triangle', f * 0.5, 0.1, 0.3, null, i * 0.08)
    })
  }

  // ── Cascade / chain reaction ─────────────────────────────────
  playCascade(level = 1) {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    // Gets higher pitched with each cascade level
    const base = 440 * (1 + (level - 1) * 0.2)
    this._osc('square', base, 0.15, 0.15)
    this._osc('square', base * 1.5, 0.1, 0.15, null, 0.08)
  }

  // ── Lightning strike (Maximus) ───────────────────────────────
  playLightning() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    // White noise burst
    const bufferSize = this._ctx.sampleRate * 0.3
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const noise = this._ctx.createBufferSource()
    noise.buffer = buffer
    const g = this._ctx.createGain()
    g.gain.setValueAtTime(0.5, this._ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.3)
    const filter = this._ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 1000
    noise.connect(filter)
    filter.connect(g)
    g.connect(this._sfxGain)
    noise.start()

    // Electric crackle tones
    this._osc('sawtooth', 120, 0.3, 0.2)
    this._osc('sawtooth', 240, 0.2, 0.15, null, 0.05)
  }

  // ── Wave crash (Tsunami) ─────────────────────────────────────
  playWaveCrash() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    // Low rumble sweep
    const bufferSize = this._ctx.sampleRate * 1.2
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)

    const noise = this._ctx.createBufferSource()
    noise.buffer = buffer
    const g = this._ctx.createGain()
    g.gain.value = 0.35
    const filter = this._ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 300
    noise.connect(filter)
    filter.connect(g)
    g.connect(this._sfxGain)
    noise.start()

    this._osc('sine', 60, 0.3, 1.2)
  }

  // ── Zeus bonus triggered ─────────────────────────────────────
  playZeusBonus() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    this.playLightning()
    setTimeout(() => this.playLightning(), 200)
    setTimeout(() => this.playBigWin(), 400)
  }

  // ── Poseidon / Tsunami bonus ─────────────────────────────────
  playTsunamiBonus() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    this.playWaveCrash()
    setTimeout(() => this.playWaveCrash(), 600)
    setTimeout(() => this.playBigWin(), 1200)
  }

  // ── Jackpot ──────────────────────────────────────────────────
  playJackpot() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    // Triumphant fanfare
    const fanfare = [523, 659, 784, 1047, 1319, 1568, 2093]
    fanfare.forEach((f, i) => {
      this._osc('sine',     f,       0.3, 0.4, null, i * 0.1)
      this._osc('triangle', f * 0.5, 0.15, 0.4, null, i * 0.1)
      this._osc('sine',     f * 2,   0.1, 0.2, null, i * 0.1 + 0.1)
    })
  }

  // ── Water level rise ─────────────────────────────────────────
  playWaterRise() {
    this._init()
    if (!this._ctx || !this._sfxEnabled) return
    this._osc('sine', 200, 0.12, 0.4)
    this._osc('sine', 250, 0.08, 0.3, null, 0.1)
  }

  // ── Toggle controls ──────────────────────────────────────────
  toggleBGM(enabled) {
    this._bgmEnabled = enabled
    if (!enabled) this.stopBGM()
  }

  toggleSFX(enabled) {
    this._sfxEnabled = enabled
  }

  setBGMVolume(v) {
    if (this._bgmGain) this._bgmGain.gain.value = v
  }

  setSFXVolume(v) {
    if (this._sfxGain) this._sfxGain.gain.value = v
  }
}

// Singleton instance
export const audio = new AudioSystem()
