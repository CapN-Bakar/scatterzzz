// src/components/AudioControls.jsx
// Floating audio toggle button — shown in all game pages
import { useState } from 'react'
import { audio } from '../lib/audioSystem'
import './AudioControls.css'

export default function AudioControls({ onBGMChange, onSFXChange }) {
  const [bgm, setBgm] = useState(true)
  const [sfx, setSfx] = useState(true)
  const [open, setOpen] = useState(false)

  const handleBGM = () => {
    const next = !bgm
    setBgm(next)
    audio.toggleBGM(next)
    onBGMChange?.(next)
  }

  const handleSFX = () => {
    const next = !sfx
    setSfx(next)
    audio.toggleSFX(next)
    onSFXChange?.(next)
  }

  return (
    <div className="audio-controls">
      <button
        className="audio-toggle-btn"
        onClick={() => setOpen(o => !o)}
        title="Audio settings"
        aria-label="Toggle audio panel"
      >
        {bgm || sfx ? '🔊' : '🔇'}
      </button>

      {open && (
        <div className="audio-panel">
          <p className="audio-panel__title">Audio</p>
          <label className="audio-row">
            <span>🎵 Music</span>
            <div
              className={`audio-switch ${bgm ? 'on' : 'off'}`}
              onClick={handleBGM}
              role="switch"
              aria-checked={bgm}
            >
              <div className="audio-switch__thumb" />
            </div>
          </label>
          <label className="audio-row">
            <span>🔔 Effects</span>
            <div
              className={`audio-switch ${sfx ? 'on' : 'off'}`}
              onClick={handleSFX}
              role="switch"
              aria-checked={sfx}
            >
              <div className="audio-switch__thumb" />
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
