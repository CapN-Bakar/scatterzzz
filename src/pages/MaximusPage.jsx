// src/pages/MaximusPage.jsx  (v2 — size fix + audio)
// Changes from v1:
//   1. Imports game_size_fixes.css (after maximus.css)
//   2. Starts BGM on mount
//   3. Passes audio theme='electric' to AudioControls
//   4. Uses updated useMaximus hook (rebalanced)

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMaximus, MAXIMUS_SYMBOLS } from '../hooks/useMaximus'  // import SYMBOLS from hook
import { audio } from '../lib/audioSystem'
import AudioControls from '../components/AudioControls'
import '../styles/maximus.css'
import '../styles/game_size_fixes.css'  // ← SIZE FIX

const BET_PRESETS      = [5, 10, 25, 50, 100]
const MAX_CASCADE_DOTS = 6

// Get paytable from hook symbols
const PAYTABLE_ROWS = (MAXIMUS_SYMBOLS || [
  { id: 'bolt',    emoji: '⚡',  label: 'Bolt',     value: 0.4 },
  { id: 'cloud',   emoji: '☁️',  label: 'Cloud',    value: 0.6 },
  { id: 'eagle',   emoji: '🦅',  label: 'Eagle',    value: 0.9 },
  { id: 'helmet',  emoji: '⛩️',  label: 'Helmet',   value: 1.5 },
  { id: 'trident', emoji: '🔱',  label: 'Trident',  value: 2.5 },
  { id: 'orb',     emoji: '🌟',  label: 'Power Orb',value: 4.0 },
]).filter(s => s.value > 0).sort((a, b) => b.value - a.value)

const PHASE_LABELS = {
  spinning:  'Summoning the Storm...',
  cascading: 'Chain Reaction!',
  bonus:     'Zeus Awakens!',
  complete:  '', idle: '',
}

export default function MaximusPage() {
  const {
    grid, betAmount, setBetAmount,
    spinning, phase, multiplier, totalPayout,
    matchedCells, bonusActive, lightningPositions,
    cascadeCount, lastResult, history,
    spin, loadHistory,
  } = useMaximus()

  const gridRef = useRef(null)

  useEffect(() => {
    loadHistory()
    audio.playBGMMaximus()
    return () => audio.stopBGM()
  }, [loadHistory])

  // Floating win number
  useEffect(() => {
    if (!lastResult || lastResult.result === 'lose' || !gridRef.current) return
    const el = document.createElement('div')
    el.textContent = `+${lastResult.payout.toLocaleString()}`
    el.style.cssText = `
      position:absolute;top:40%;left:50%;
      transform:translate(-50%,-50%);
      font-family:var(--font-display);
      font-size:clamp(1.4rem,4vw,2.2rem);font-weight:900;
      color:${lastResult.result === 'jackpot' ? 'var(--zeus-gold)' : 'var(--zeus-electric)'};
      text-shadow:0 0 18px currentColor;pointer-events:none;z-index:30;
      animation:floatUp 1.2s ease forwards;
    `
    gridRef.current.appendChild(el)
    setTimeout(() => el.remove(), 1300)
  }, [lastResult])

  const canSpin    = !spinning && betAmount > 0
  const matchedSet = new Set(matchedCells.map(c => `${c.row}-${c.col}`))

  return (
    <div className="maximus-page">
      <div className="maximus-page__inner">
        <Link to="/" className="back-link" style={{ color: 'rgba(125,249,255,0.5)' }}>← Lobby</Link>

        <div className="maximus-header">
          <h1 className="maximus-title">⚡ MAXIMUS</h1>
          <p className="maximus-subtitle">The Wrath of Zeus</p>
        </div>

        <div className="maximus-cabinet" ref={gridRef}>
          {bonusActive && <div className="lightning-flash-overlay" />}
          {bonusActive && phase === 'bonus' && (
            <div className="zeus-bonus-banner">
              <div className="zeus-bonus-banner__title">⚡ ZEUS STRIKES! ⚡</div>
              <div className="zeus-bonus-banner__sub">Lightning Wilds Incoming</div>
            </div>
          )}

          {/* Lightning overlays */}
          {lightningPositions?.length > 0 && (
            <div className="lightning-overlay">
              {lightningPositions.map(({ r, c, key }) => (
                <div key={key} className="lightning-strike" style={{
                  left: `${(c + 0.5) * 20}%`,
                  top:  `${(r + 0.5) * 16}%`,
                }}>⚡</div>
              ))}
            </div>
          )}

          {/* 5x5 Grid */}
          <div className="maximus-grid">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isMatched   = matchedSet.has(`${r}-${c}`)
                const isLightning = lightningPositions?.find(p => p.r === r && p.c === c)
                return (
                  <div
                    key={cell.id}
                    className="maximus-tile"
                    data-state={isMatched ? 'matched' : isLightning ? 'wild' : cell.state}
                    style={{ animationDelay: cell.state === 'new' ? `${(r * 5 + c) * 0.025}s` : '0s' }}
                    title={cell.symbol?.label}
                  >
                    {cell.symbol?.emoji}
                  </div>
                )
              })
            )}
          </div>

          {/* Result */}
          {lastResult && !spinning && (
            <div className={`result-banner ${lastResult.result}`}>
              <div className="result-banner__label">
                {lastResult.result === 'jackpot' ? '⚡ OLYMPUS JACKPOT ⚡' :
                 lastResult.result === 'win' ? `Win! (×${lastResult.multiplier})` :
                 'The gods are silent...'}
              </div>
              {lastResult.result !== 'lose' && (
                <div className="result-banner__amount">
                  +{lastResult.payout.toLocaleString()} chips
                  {cascadeCount > 1 && ` · ${cascadeCount} cascades`}
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="maximus-controls">
            <div className="maximus-info-row">
              <div className="maximus-stat">
                <div className="maximus-stat__value">
                  <span className="multiplier-badge">×{Math.min(multiplier, 5)}</span>
                </div>
                <div className="maximus-stat__label">Multiplier</div>
              </div>
              <div className="maximus-stat">
                <div className="maximus-stat__value" style={{ color: 'var(--zeus-gold)' }}>
                  {totalPayout > 0 ? `+${totalPayout.toLocaleString()}` : '—'}
                </div>
                <div className="maximus-stat__label">Win</div>
              </div>
              <div className="maximus-stat">
                <div className="cascade-chain">
                  {Array.from({ length: MAX_CASCADE_DOTS }).map((_, i) => (
                    <div key={i} className={`cascade-dot ${i < cascadeCount ? 'active' : ''}`} />
                  ))}
                </div>
                <div className="maximus-stat__label" style={{ marginTop: '0.4rem' }}>Cascades</div>
              </div>
            </div>

            <div className={`phase-indicator ${spinning ? 'active' : ''}`}>
              {PHASE_LABELS[phase] || ''}
            </div>

            <div className="bet-row">
              <span className="bet-row__label">Bet</span>
              <span className="bet-row__amount">🪙 {betAmount}</span>
              <div className="bet-presets">
                {BET_PRESETS.map(p => (
                  <button key={p}
                    className={`bet-preset-btn ${betAmount === p ? 'active' : ''}`}
                    onClick={() => setBetAmount(p)} disabled={spinning}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button className="maximus-spin-btn" onClick={spin} disabled={!canSpin}>
              {spinning
                ? <span style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem' }}>
                    <span className="spinner" style={{ width:18,height:18,borderTopColor:'var(--zeus-electric)',border:'2px solid rgba(125,249,255,0.2)' }} />
                    {PHASE_LABELS[phase] || 'Spinning...'}
                  </span>
                : '⚡ CALL THE STORM'}
            </button>
          </div>
        </div>

        {/* Paytable */}
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{ cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:'0.72rem',
            fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',padding:'0.5rem 0',userSelect:'none' }}>
            Paytable ↓
          </summary>
          <div className="maximus-paytable">
            <div className="maximus-paytable__header">
              <span></span><span>Name</span><span>Min</span><span>Value</span>
            </div>
            {PAYTABLE_ROWS.map(sym => (
              <div className="maximus-paytable__row" key={sym.id}>
                <span className="maximus-paytable__emoji">{sym.emoji}</span>
                <span className="maximus-paytable__name">{sym.label}</span>
                <span className="maximus-paytable__min">3+ cluster</span>
                <span className="maximus-paytable__value">{sym.value}×</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop:'0.6rem',fontSize:'0.72rem',color:'rgba(255,255,255,0.22)',lineHeight:1.5 }}>
            Cascade multiplier increases each chain (max ×5). Cluster 5+=1.2×, 6-7=1.5×, 8+=2×. Max payout: 50× bet.
          </p>
        </details>

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop:'1.5rem' }}>
            <p style={{ fontSize:'0.68rem',fontWeight:800,textTransform:'uppercase',
              letterSpacing:'0.12em',color:'rgba(255,255,255,0.22)',marginBottom:'0.6rem' }}>
              Recent Spins
            </p>
            <div style={{ display:'flex',flexDirection:'column',gap:'0.3rem' }}>
              {history.map(h => (
                <div key={h.id} style={{ display:'flex',alignItems:'center',gap:'0.75rem',
                  padding:'0.5rem 0.85rem',background:'rgba(255,255,255,0.02)',
                  border:'1px solid rgba(255,255,255,0.04)',borderRadius:8,fontSize:'0.78rem' }}>
                  <span style={{ flex:1,color:'rgba(255,255,255,0.3)' }}>Bet: {h.bet_amount}</span>
                  <span style={{ fontWeight:700, color: h.payout>0 ? 'var(--zeus-electric)' : 'rgba(255,255,255,0.18)' }}>
                    {h.payout > 0 ? `+${h.payout}` : '—'}
                  </span>
                  <span className={`badge badge--${h.result}`}>{h.result}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <AudioControls theme="electric" />
    </div>
  )
}
