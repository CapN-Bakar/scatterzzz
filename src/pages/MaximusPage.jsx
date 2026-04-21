// src/pages/MaximusPage.jsx
// ─────────────────────────────────────────────────────────────────
// MAXIMUS — Zeus / Lightning
// 5x5 grid, cluster wins, cascade multipliers, Zeus lightning bonus
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  useMaximus,
  MAXIMUS_SYMBOLS,
} from '../hooks/useMaximus'
import { audio } from '../lib/audioSystem'
import AudioControls from '../components/AudioControls'
import '../styles/maximus.css'

const BET_PRESETS = [5, 10, 25, 50, 100]
const MAX_CASCADE_DOTS = 6

// Paytable rows (symbols with value > 0)
const PAYTABLE_ROWS = MAXIMUS_SYMBOLS.filter(s => s.value > 0).sort((a, b) => b.value - a.value)

// Phase label map
const PHASE_LABELS = {
  spinning:   'Summoning the Storm...',
  cascading:  'Chain Reaction!',
  bonus:      'Zeus Awakens!',
  complete:   '',
  idle:       '',
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
    // Start BGM on mount (user already interacted by navigating here)
    audio.playBGMMaximus()
    return () => audio.stopBGM()
  }, [loadHistory])

  // Spawn floating "+payout" numbers when win occurs
  useEffect(() => {
    if (!lastResult || lastResult.result === 'lose' || !gridRef.current) return
    const el = document.createElement('div')
    el.textContent = `+${lastResult.payout.toLocaleString()}`
    el.style.cssText = `
      position:absolute; top:40%; left:50%;
      transform:translate(-50%,-50%);
      font-family:var(--font-display);
      font-size:clamp(1.5rem,4vw,2.5rem);
      font-weight:900;
      color:${lastResult.result === 'jackpot' ? 'var(--zeus-gold)' : 'var(--zeus-electric)'};
      text-shadow:0 0 20px currentColor;
      pointer-events:none;
      z-index:30;
      animation:floatUp 1.2s ease forwards;
    `
    gridRef.current.appendChild(el)
    setTimeout(() => el.remove(), 1300)
  }, [lastResult])

  const canSpin = !spinning && betAmount > 0

  // Build a Set for quick matched-cell lookup
  const matchedSet = new Set(matchedCells.map(c => `${c.row}-${c.col}`))

  return (
    <div className="maximus-page">
      <div className="maximus-page__inner">

        {/* Back */}
        <Link to="/" className="back-link" style={{ color: 'rgba(125,249,255,0.5)' }}>
          ← Lobby
        </Link>

        {/* Header */}
        <div className="maximus-header">
          <h1 className="maximus-title">⚡ MAXIMUS</h1>
          <p className="maximus-subtitle">The Wrath of Zeus</p>
        </div>

        {/* Cabinet */}
        <div className="maximus-cabinet" ref={gridRef}>

          {/* Lightning bonus full-screen flash */}
          {bonusActive && <div className="lightning-flash-overlay" />}

          {/* Zeus bonus banner */}
          {bonusActive && phase === 'bonus' && (
            <div className="zeus-bonus-banner">
              <div className="zeus-bonus-banner__title">⚡ ZEUS STRIKES! ⚡</div>
              <div className="zeus-bonus-banner__sub">Lightning Wilds Incoming</div>
            </div>
          )}

          {/* Lightning strike overlays */}
          {lightningPositions.length > 0 && (
            <div className="lightning-overlay">
              {lightningPositions.map(({ r, c, key }) => {
                // Calculate tile position as percentage
                const tileSize = 100 / 5
                return (
                  <div
                    key={key}
                    className="lightning-strike"
                    style={{
                      left: `${(c + 0.5) * tileSize}%`,
                      top:  `${(r + 0.5) * (80 / 5)}%`, // approx
                    }}
                  >
                    ⚡
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 5x5 Grid ── */}
          <div className="maximus-grid">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isMatched = matchedSet.has(`${r}-${c}`)
                const isLightning = lightningPositions.find(p => p.r === r && p.c === c)
                return (
                  <div
                    key={cell.id}
                    className="maximus-tile"
                    data-state={isMatched ? 'matched' : isLightning ? 'wild' : cell.state}
                    style={{
                      animationDelay: cell.state === 'new' ? `${(r * 5 + c) * 0.03}s` : '0s',
                    }}
                    title={cell.symbol?.label}
                  >
                    {cell.symbol?.emoji}
                  </div>
                )
              })
            )}
          </div>

          {/* ── Result banner ── */}
          {lastResult && !spinning && (
            <div className={`result-banner ${lastResult.result}`}>
              <div className="result-banner__label">
                {lastResult.result === 'jackpot' && '⚡ '}
                {lastResult.result === 'jackpot' ? 'OLYMPUS JACKPOT' :
                 lastResult.result === 'win'     ? `Win! (×${lastResult.multiplier})` :
                 'The gods are silent...'}
                {lastResult.result === 'jackpot' && ' ⚡'}
              </div>
              {lastResult.result !== 'lose' && (
                <div className="result-banner__amount">
                  +{lastResult.payout.toLocaleString()} chips
                  {cascadeCount > 1 && ` · ${cascadeCount} cascades`}
                </div>
              )}
            </div>
          )}

          {/* ── Controls ── */}
          <div className="maximus-controls">

            {/* Stats row */}
            <div className="maximus-info-row">
              <div className="maximus-stat">
                <div className="maximus-stat__value">
                  <span className="multiplier-badge">×{multiplier}</span>
                </div>
                <div className="maximus-stat__label">Multiplier</div>
              </div>

              <div className="maximus-stat">
                <div className="maximus-stat__value" style={{ color: 'var(--zeus-gold)' }}>
                  🪙 {totalPayout > 0 ? `+${totalPayout.toLocaleString()}` : '—'}
                </div>
                <div className="maximus-stat__label">Session Win</div>
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

            {/* Phase label */}
            <div className={`phase-indicator ${spinning ? 'active' : ''}`}>
              {PHASE_LABELS[phase] || ''}
            </div>

            {/* Bet row */}
            <div className="bet-row">
              <span className="bet-row__label">Bet</span>
              <span className="bet-row__amount">🪙 {betAmount}</span>
              <div className="bet-presets">
                {BET_PRESETS.map(p => (
                  <button
                    key={p}
                    className={`bet-preset-btn ${betAmount === p ? 'active' : ''}`}
                    onClick={() => setBetAmount(p)}
                    disabled={spinning}
                  >
                    {p}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={betAmount}
                  onChange={e => setBetAmount(Math.max(1, Number(e.target.value)))}
                  disabled={spinning}
                  style={{
                    width: 52, background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, color: '#fff',
                    padding: '0.25rem 0.35rem', fontSize: '0.75rem', textAlign: 'center',
                  }}
                />
              </div>
            </div>

            {/* SPIN */}
            <button
              className="maximus-spin-btn"
              onClick={spin}
              disabled={!canSpin}
            >
              {spinning
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                    <span className="spinner" style={{ width: 20, height: 20, borderTopColor: 'var(--zeus-electric)', border: '2px solid rgba(125,249,255,0.2)' }} />
                    {PHASE_LABELS[phase] || 'Spinning...'}
                  </span>
                : '⚡ CALL THE STORM'
              }
            </button>
          </div>
        </div>

        {/* Paytable */}
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{
            cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
            fontSize: '0.75rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '0.5rem 0', userSelect: 'none',
          }}>
            Paytable ↓
          </summary>
          <div className="maximus-paytable">
            <div className="maximus-paytable__header">
              <span>Symbol</span>
              <span>Name</span>
              <span>Min 3</span>
              <span>Value</span>
            </div>
            {PAYTABLE_ROWS.map(sym => (
              <div className="maximus-paytable__row" key={sym.id}>
                <span className="maximus-paytable__emoji">{sym.emoji}</span>
                <span className="maximus-paytable__name">{sym.label}</span>
                <span className="maximus-paytable__min">3+ cluster</span>
                <span className="maximus-paytable__value">{sym.value}x</span>
              </div>
            ))}
            <div className="maximus-paytable__row" style={{ background: 'rgba(125,249,255,0.03)' }}>
              <span className="maximus-paytable__emoji">🌩️</span>
              <span className="maximus-paytable__name">Scatter (3+)</span>
              <span className="maximus-paytable__min">Zeus Bonus</span>
              <span className="maximus-paytable__value" style={{ color: 'var(--zeus-electric)' }}>⚡</span>
            </div>
          </div>
          <p style={{
            marginTop: '0.75rem', fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.25)', lineHeight: 1.5
          }}>
            Clusters of 3+ adjacent matching symbols win. Each cascade increases the multiplier by 1.
            Cluster of 5+ pays 1.5× bonus. Cluster of 6–7 pays 2×. Cluster of 8+ pays 3×.
          </p>
        </details>

        {/* Recent history */}
        {history.length > 0 && (
          <div className="maximus-history">
            <p style={{
              fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', marginBottom: '0.6rem'
            }}>
              Recent Spins
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {history.map(h => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.55rem 0.85rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: 8, fontSize: '0.8rem',
                }}>
                  <span style={{ flex: 1, color: 'rgba(255,255,255,0.4)' }}>
                    Bet: {h.bet_amount}
                  </span>
                  <span style={{
                    fontWeight: 700,
                    color: h.payout > 0 ? 'var(--zeus-electric)' : 'rgba(255,255,255,0.2)',
                  }}>
                    {h.payout > 0 ? `+${h.payout}` : '—'}
                  </span>
                  <span className={`badge badge--${h.result}`}>{h.result}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <AudioControls />
    </div>
  )
}
