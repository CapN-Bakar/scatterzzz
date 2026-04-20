// src/components/games/SlotMachine.jsx
// ─────────────────────────────────────────────
// Reusable slot machine UI. Accepts theme, symbols, paytable.
// Used by both LeprechaunPage and WildWestPage.
// ─────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import { useSlotMachine } from '../../hooks/useSlotMachine'
import { useWallet } from '../../context/WalletContext'
import '../../styles/slot.css'

// Bet preset buttons
const BET_PRESETS = [5, 10, 25, 50, 100]

export default function SlotMachine({ symbols, paytable, gameName, theme }) {
  const { balance } = useWallet()
  const {
    reels, spinning, lastResult,
    history, betAmount, setBetAmount,
    spin, loadHistory,
  } = useSlotMachine({ symbols, paytable, gameName })

  const machineRef = useRef(null)

  // Load history on mount
  useEffect(() => { loadHistory() }, [loadHistory])

  // Spawn coin-rain particles on win
  useEffect(() => {
    if (!lastResult || lastResult.result === 'lose') return
    const container = machineRef.current
    if (!container) return

    const count = lastResult.result === 'jackpot' ? 12 : 6
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span')
      el.className = 'coin-particle'
      el.textContent = theme.coinEmoji ?? '🪙'
      el.style.left = `${Math.random() * 80 + 10}%`
      el.style.top = `${Math.random() * 40 + 10}%`
      el.style.animationDelay = `${Math.random() * 0.4}s`
      container.appendChild(el)
      setTimeout(() => el.remove(), 1400)
    }
  }, [lastResult, theme.coinEmoji])

  const canSpin = !spinning && betAmount > 0 && betAmount <= balance

  return (
    <div className="slot-machine" ref={machineRef} style={theme.cssVars}>

      {/* ── Reels ── */}
      <div className="reels-container">
        {reels.map((symbol, i) => (
          <div
            key={i}
            className={[
              'reel',
              spinning ? 'spinning' : '',
              lastResult && lastResult.result !== 'lose' ? 'win-flash' : '',
            ].join(' ')}
            style={spinning ? { animationDelay: `${i * 0.12}s` } : {}}
          >
            <span className="reel__symbol" role="img" aria-label={symbol.label}>
              {symbol.emoji}
            </span>
          </div>
        ))}
      </div>

      {/* ── Result Banner ── */}
      {lastResult && !spinning && (
        <div className={`win-banner win-banner--${lastResult.result}`}>
          <div className="win-banner__label">
            {lastResult.result === 'jackpot' && '🎉 '}
            {lastResult.label}
            {lastResult.result === 'jackpot' && ' 🎉'}
          </div>
          <div className="win-banner__amount">
            {lastResult.result !== 'lose'
              ? `+${lastResult.payout.toLocaleString()} chips`
              : `Lost ${lastResult.betAmount.toLocaleString()} chips`}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="slot-controls">
        {/* Bet amount control */}
        <div className="bet-control">
          <span className="bet-control__label">Bet</span>
          <div className="bet-control__amount">
            {betAmount.toLocaleString()}
            <span> chips</span>
          </div>
          <div className="bet-btns">
            {BET_PRESETS.map(preset => (
              <button
                key={preset}
                className="bet-btn"
                onClick={() => setBetAmount(preset)}
                disabled={spinning || preset > balance}
              >
                {preset}
              </button>
            ))}
            {/* Custom input */}
            <input
              type="number"
              min={1}
              max={balance}
              value={betAmount}
              onChange={e => setBetAmount(Math.max(1, Number(e.target.value)))}
              disabled={spinning}
              style={{
                width: 56, background: 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)', padding: '0.3rem 0.4rem',
                fontSize: '0.78rem', textAlign: 'center',
              }}
            />
          </div>
        </div>

        {/* Balance display */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0 0.25rem'
        }}>
          <span>Balance: <strong style={{ color: 'var(--text-primary)' }}>
            🪙 {balance.toLocaleString()}
          </strong></span>
          {lastResult && lastResult.result !== 'lose' && (
            <span style={{ color: 'var(--neon-green)' }}>
              +{lastResult.payout.toLocaleString()} won!
            </span>
          )}
        </div>

        {/* SPIN button */}
        <button
          className="spin-btn"
          onClick={spin}
          disabled={!canSpin}
        >
          {spinning ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span className="spinner" style={{ width: 20, height: 20, borderTopColor: '#1a1100' }} />
              Spinning...
            </span>
          ) : balance < betAmount ? 'Not Enough Chips' : '🎰 SPIN'}
        </button>
      </div>
    </div>
  )
}

// ── Paytable component ──────────────────────────────────
export function Paytable({ paytable }) {
  return (
    <div className="paytable">
      <div className="paytable__header">
        <span>Combination</span>
        <span>Name</span>
        <span>Pays</span>
      </div>
      {paytable.map((entry, i) => (
        <div className="paytable__row" key={i}>
          <span className="paytable__symbols">
            {entry.match === 'triple'
              ? `${entry.emoji}${entry.emoji}${entry.emoji}`
              : `${entry.emoji}${entry.emoji}✦`}
          </span>
          <span className="paytable__label">{entry.label}</span>
          <span className="paytable__multi">{entry.multiplier}x</span>
        </div>
      ))}
      <div className="paytable__row">
        <span className="paytable__symbols">✦✦✦</span>
        <span className="paytable__label">Any Triple</span>
        <span className="paytable__multi">5x</span>
      </div>
      <div className="paytable__row">
        <span className="paytable__symbols">✦✦</span>
        <span className="paytable__label">Any Pair</span>
        <span className="paytable__multi">1.5x</span>
      </div>
    </div>
  )
}

// ── Game History component ──────────────────────────────
export function GameHistory({ history }) {
  if (!history.length) return null

  return (
    <div className="game-history">
      <p className="game-history__title">Recent Spins</p>
      <div className="history-list">
        {history.map(item => {
          const syms = Array.isArray(item.symbols) ? item.symbols : []
          return (
            <div className="history-item" key={item.id}>
              <span className="history-item__symbols">
                {syms.join(' ')}
              </span>
              <span className="history-item__bet">
                -{item.bet_amount}
              </span>
              <span className={`history-item__payout ${item.result}`}>
                {item.payout > 0 ? `+${item.payout}` : '—'}
              </span>
              <span className={`badge badge--${item.result}`}>
                {item.result}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
