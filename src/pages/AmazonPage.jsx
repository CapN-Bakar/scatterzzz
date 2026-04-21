// src/pages/AmazonPage.jsx
// ═══════════════════════════════════════════════════════════════
// AMAZON — Jungle / Rainforest
// 4×4 grid, cluster wins, vine spread, monkey/snake specials,
// Jungle Frenzy bonus
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAmazon, AMAZON_SYMBOLS } from '../hooks/useAmazon'
import { audio } from '../lib/audioSystem'
import AudioControls from '../components/AudioControls'
import '../styles/amazon.css'

const BET_PRESETS    = [5, 10, 25, 50, 100]
const MAX_CASCADE_SHOW = 5
const PHASE_LABELS   = {
  spinning:  'Entering the jungle...',
  cascading: 'Chain reaction!',
  bonus:     'Jungle Frenzy!',
  frenzy:    'Jungle Frenzy!',
  complete:  '',
  idle:      '',
}

const PAYTABLE = AMAZON_SYMBOLS.filter(s => s.value > 0).sort((a, b) => b.value - a.value)

export default function AmazonPage() {
  const {
    grid, betAmount, setBetAmount,
    spinning, phase, totalPayout,
    matchedCells, bonusActive, bonusSpinsLeft,
    cascadeCount, vineCount, lastResult, history,
    spin, loadHistory,
  } = useAmazon()

  const cabinetRef = useRef(null)

  useEffect(() => {
    loadHistory()
    audio.playBGMAmazon()
    return () => audio.stopBGM()
  }, [loadHistory])

  // Floating win particles
  useEffect(() => {
    if (!lastResult || lastResult.result === 'lose' || !cabinetRef.current) return
    const el = document.createElement('div')
    el.textContent = `+${lastResult.payout.toLocaleString()}`
    el.style.cssText = `
      position:absolute;top:45%;left:50%;
      transform:translate(-50%,-50%);
      font-family:var(--font-display);
      font-size:clamp(1.4rem,4vw,2.2rem);
      font-weight:900;
      color:${lastResult.result === 'jackpot' ? 'var(--jungle-gold)' : 'var(--jungle-lime)'};
      text-shadow:0 0 18px currentColor;
      pointer-events:none;z-index:30;
      animation:floatUp 1.2s ease forwards;
    `
    cabinetRef.current.appendChild(el)
    setTimeout(() => el.remove(), 1300)
  }, [lastResult])

  // Frenzy leaf particles
  useEffect(() => {
    if (!bonusActive || !cabinetRef.current) return
    const cabinet = cabinetRef.current
    const leaves = ['🍃', '🌿', '🍀', '🌱']
    const interval = setInterval(() => {
      const el = document.createElement('div')
      el.className = 'frenzy-leaf'
      el.textContent = leaves[Math.floor(Math.random() * leaves.length)]
      el.style.left = `${10 + Math.random() * 80}%`
      el.style.animationDelay = `${Math.random() * 0.3}s`
      cabinet.appendChild(el)
      setTimeout(() => el.remove(), 1600)
    }, 200)
    return () => clearInterval(interval)
  }, [bonusActive])

  const matchedSet = new Set(matchedCells.map(c => `${c.row}-${c.col}`))
  const canSpin    = !spinning && betAmount > 0

  return (
    <div className="amazon-page">
      <div className="amazon-page__inner">

        <Link to="/" className="back-link" style={{ color: 'rgba(93,170,0,0.45)' }}>
          ← Lobby
        </Link>

        {/* Header */}
        <div className="amazon-header">
          <h1 className="amazon-title">🌿 AMAZON</h1>
          <p className="amazon-subtitle">The Heart of the Jungle</p>
        </div>

        {/* Cabinet */}
        <div className="amazon-cabinet" ref={cabinetRef}>

          {/* Jungle Frenzy overlay */}
          {bonusActive && (phase === 'bonus' || phase === 'frenzy') && (
            <div className="frenzy-overlay">
              <div className="frenzy-leaves" />
              <div className="frenzy-title">🦋 JUNGLE<br/>FRENZY! 🐒</div>
              {bonusSpinsLeft > 0 && (
                <div className="frenzy-spins-left">
                  {bonusSpinsLeft} Spin{bonusSpinsLeft !== 1 ? 's' : ''} Remaining
                </div>
              )}
            </div>
          )}

          {/* ── 4x4 Grid ── */}
          <div className="amazon-grid">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isMatched = matchedSet.has(`${r}-${c}`)
                return (
                  <div
                    key={cell.id}
                    className="amazon-tile"
                    data-state={isMatched ? 'matched' : cell.state}
                    data-symbol={cell.symbol?.id}
                    style={{
                      animationDelay: (cell.state === 'new' || cell.state === 'vine-spawn')
                        ? `${(r * 4 + c) * 0.04}s` : '0s',
                    }}
                    title={cell.symbol?.label}
                  >
                    {cell.symbol?.emoji}
                  </div>
                )
              })
            )}
          </div>

          {/* Result banner */}
          {lastResult && !spinning && (
            <div className={`amazon-result ${lastResult.result}`}>
              <div className="result-label">
                {lastResult.bonus && '🦋 '}
                {lastResult.result === 'jackpot' ? 'JUNGLE JACKPOT!' :
                 lastResult.result === 'win'     ? `Win!${cascadeCount > 1 ? ` (${cascadeCount} cascades)` : ''}` :
                 'The jungle is silent...'}
              </div>
              {lastResult.result !== 'lose' && (
                <div className="result-amount">+{lastResult.payout.toLocaleString()} chips</div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="amazon-controls">

            {/* Vine indicator */}
            {vineCount > 0 && (
              <div className="vine-indicator">
                🌿 {vineCount} vine{vineCount !== 1 ? 's' : ''} spreading
                <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                  {Array.from({ length: Math.min(vineCount, 5) }).map((_, i) => (
                    <div key={i} className="vine-dot active" />
                  ))}
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="amazon-info-row">
              <div className="amazon-stat">
                <div className="amazon-stat__value" style={{ color: 'var(--jungle-gold)' }}>
                  {totalPayout > 0 ? `+${totalPayout.toLocaleString()}` : '—'}
                </div>
                <div className="amazon-stat__label">Win</div>
              </div>
              <div className="amazon-stat">
                <div className="cascade-dots">
                  {Array.from({ length: MAX_CASCADE_SHOW }).map((_, i) => (
                    <div key={i} className={`cascade-dot-jungle ${i < cascadeCount ? 'active' : ''}`} />
                  ))}
                </div>
                <div className="amazon-stat__label" style={{ marginTop: '0.4rem' }}>Cascades</div>
              </div>
              <div className="amazon-stat">
                <div className="amazon-stat__value">
                  {bonusActive ? `🦋 ${bonusSpinsLeft}` : '—'}
                </div>
                <div className="amazon-stat__label">Frenzy</div>
              </div>
            </div>

            {/* Phase label */}
            <div className={`amazon-phase ${spinning ? 'active' : ''}`}>
              {PHASE_LABELS[phase] || ''}
            </div>

            {/* Bet row */}
            <div className="amazon-bet-row bet-row">
              <span className="bet-row__label">Bet</span>
              <span className="bet-row__amount" style={{ color: 'var(--jungle-lime)' }}>
                🪙 {betAmount}
              </span>
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
                    width: 52, background: 'rgba(93,170,0,0.04)',
                    border: '1px solid rgba(93,170,0,0.09)',
                    borderRadius: 6, color: '#fff',
                    padding: '0.25rem 0.35rem', fontSize: '0.75rem', textAlign: 'center',
                  }}
                />
              </div>
            </div>

            {/* SPIN */}
            <button
              className="amazon-spin-btn"
              onClick={spin}
              disabled={!canSpin}
            >
              {spinning
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                    <span className="spinner" style={{
                      width: 18, height: 18,
                      borderTopColor: 'var(--jungle-lime)',
                      border: '2px solid rgba(93,170,0,0.15)',
                    }} />
                    {PHASE_LABELS[phase] || 'Spinning...'}
                  </span>
                : '🌿 ENTER THE JUNGLE'
              }
            </button>
          </div>
        </div>

        {/* Mechanic tip */}
        <div style={{
          marginTop: '1.25rem',
          background: 'rgba(93,170,0,0.03)',
          border: '1px solid rgba(93,170,0,0.07)',
          borderRadius: 12, padding: '1rem',
          fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6,
        }}>
          <strong style={{ color: 'rgba(93,170,0,0.55)' }}>🌿 Vine Spread:</strong>{' '}
          After wins, surviving tiles can become vines — they spread, connect clusters, and chain more wins.
          <strong style={{ color: 'rgba(255,165,0,0.5)' }}> 🐒 Monkey</strong> adds a random multiplier.
          <strong style={{ color: 'rgba(93,170,0,0.5)' }}> 🐍 Snake</strong> removes extra tiles for bonus cascades.
          Collect 3+ <strong style={{ color: 'rgba(180,230,100,0.5)' }}>🦋 Butterflies</strong> for Jungle Frenzy!
        </div>

        {/* Paytable */}
        <details style={{ marginTop: '1rem' }}>
          <summary style={{
            cursor: 'pointer', color: 'rgba(93,170,0,0.3)',
            fontSize: '0.72rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '0.5rem 0', userSelect: 'none',
          }}>
            Paytable ↓
          </summary>
          <div className="amazon-paytable">
            <div className="amazon-paytable__header">
              <span></span><span>Symbol</span><span>Special</span><span>Value</span>
            </div>
            {PAYTABLE.map(sym => (
              <div className="amazon-paytable__row" key={sym.id}>
                <span className="amazon-paytable__emoji">{sym.emoji}</span>
                <span className="amazon-paytable__name">{sym.label}</span>
                <span className="amazon-paytable__special">
                  {sym.special === 'multiplier' ? '×1.2–2.0' :
                   sym.special === 'cascade'    ? '+2 removes' : '—'}
                </span>
                <span className="amazon-paytable__value">{sym.value}x</span>
              </div>
            ))}
            <div className="amazon-paytable__row" style={{ background: 'rgba(93,170,0,0.03)' }}>
              <span className="amazon-paytable__emoji">🦋</span>
              <span className="amazon-paytable__name">Butterfly (3+)</span>
              <span className="amazon-paytable__special" style={{ color: 'var(--jungle-lime)' }}>Frenzy!</span>
              <span className="amazon-paytable__value">—</span>
            </div>
            <div className="amazon-paytable__row">
              <span className="amazon-paytable__emoji">🌿</span>
              <span className="amazon-paytable__name">Vine (spread)</span>
              <span className="amazon-paytable__special">Connects</span>
              <span className="amazon-paytable__value">0x</span>
            </div>
          </div>
          <p style={{ marginTop: '0.65rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.5 }}>
            Cluster of 3=1×, 4=1.2×, 5=1.5×, 6+=2×. Vine tiles connect clusters but pay 0.
            Max payout: 40× bet per spin.
          </p>
        </details>

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{
              fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: 'rgba(93,170,0,0.22)', marginBottom: '0.6rem',
            }}>Recent Spins</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {history.map(h => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.85rem',
                  background: 'rgba(93,170,0,0.02)',
                  border: '1px solid rgba(93,170,0,0.05)',
                  borderRadius: 8, fontSize: '0.78rem',
                }}>
                  <span style={{ flex: 1, color: 'rgba(255,255,255,0.28)' }}>Bet: {h.bet_amount}</span>
                  <span style={{
                    fontWeight: 700,
                    color: h.payout > 0 ? 'var(--jungle-lime)' : 'rgba(255,255,255,0.18)',
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

      <AudioControls theme="jungle" />
    </div>
  )
}
