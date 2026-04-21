// src/components/AudioControls.jsx  (v2)
// Floating audio toggle — works across all 5 games.
// Accepts optional `theme` prop: 'default'|'electric'|'ocean'|'jungle'
import { useState } from 'react'
import { audio } from '../lib/audioSystem'
import './AudioControls.css'

const THEME_COLORS = {
  default:  { accent: '#f5c518', bg: 'rgba(10,10,18,0.88)' },
  electric: { accent: '#7df9ff', bg: 'rgba(6,6,15,0.9)'    },
  ocean:    { accent: '#00e5cc', bg: 'rgba(2,13,26,0.9)'   },
  jungle:   { accent: '#5daa00', bg: 'rgba(6,15,5,0.9)'    },
}

export default function AudioControls({ theme = 'default', onBGMChange, onSFXChange }) {
  const [bgm,  setBgm]  = useState(true)
  const [sfx,  setSfx]  = useState(true)
  const [open, setOpen] = useState(false)

  const colors = THEME_COLORS[theme] || THEME_COLORS.default

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
        aria-label="Toggle audio"
        style={{ '--audio-bg': colors.bg, '--audio-accent': colors.accent }}
      >
        {bgm || sfx ? '🔊' : '🔇'}
      </button>

      {open && (
        <div className="audio-panel" style={{
          '--audio-bg': colors.bg, '--audio-accent': colors.accent,
          borderColor: `${colors.accent}22`,
        }}>
          <p className="audio-panel__title">Audio</p>

          <label className="audio-row">
            <span>🎵 Music</span>
            <div
              className={`audio-switch ${bgm ? 'on' : 'off'}`}
              onClick={handleBGM}
              role="switch"
              aria-checked={bgm}
              style={{ '--switch-on': colors.accent }}
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
              style={{ '--switch-on': colors.accent }}
            >
              <div className="audio-switch__thumb" />
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
