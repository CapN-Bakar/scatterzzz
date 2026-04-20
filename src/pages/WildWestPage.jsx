// src/pages/WildWestPage.jsx
// ─────────────────────────────────────────────
// Wild West — Western-themed slot machine.
// Theme: burnt orange, whiskey amber, desert dust.
// ─────────────────────────────────────────────
import { Link } from 'react-router-dom'
import SlotMachine, { Paytable, GameHistory } from '../components/games/SlotMachine'
import { useSlotMachine } from '../hooks/useSlotMachine'
import { useEffect } from 'react'

// ── Symbol definitions ─────────────────────────────────
const WILDWEST_SYMBOLS = [
  { id: '🤠', emoji: '🤠', label: 'Cowboy Hat',  weight: 4 },
  { id: '🐎', emoji: '🐎', label: 'Horse',       weight: 3 },
  { id: '🔫', emoji: '🔫', label: 'Revolver',    weight: 3 },
  { id: '🥃', emoji: '🥃', label: 'Whiskey',     weight: 4 },
  { id: '💰', emoji: '💰', label: 'Moneybag',    weight: 2 },
  { id: '⭐', emoji: '⭐', label: 'Sheriff Star', weight: 1 }, // rarest
]

// ── Paytable ───────────────────────────────────────────
const WILDWEST_PAYTABLE = [
  { match: 'triple', symbol: '⭐', emoji: '⭐', label: '⭐ Sheriff\'s Jackpot!', multiplier: 25 },
  { match: 'triple', symbol: '💰', emoji: '💰', label: '💰 Gold Rush!',          multiplier: 15 },
  { match: 'triple', symbol: '🐎', emoji: '🐎', label: '🐎 Wild Ride!',          multiplier: 10 },
  { match: 'triple', symbol: '🔫', emoji: '🔫', label: '🔫 High Noon!',          multiplier: 8  },
  { match: 'triple', symbol: '🤠', emoji: '🤠', label: '🤠 Cowboy Triple!',      multiplier: 6  },
  { match: 'triple', symbol: '🥃', emoji: '🥃', label: '🥃 Whiskey Round!',      multiplier: 4  },
  { match: 'pair',   symbol: '⭐', emoji: '⭐', label: 'Star Pair',              multiplier: 3  },
  { match: 'pair',   symbol: '💰', emoji: '💰', label: 'Gold Pair',              multiplier: 2  },
  { match: 'pair',   symbol: '🐎', emoji: '🐎', label: 'Horse Pair',             multiplier: 2  },
]

// ── Theme config ───────────────────────────────────────
const WILDWEST_THEME = {
  coinEmoji: '💰',
  cssVars: {
    '--slot-accent':   '#d4781a',
    '--slot-glow':     'rgba(212, 120, 26, 0.35)',
    '--slot-btn-from': '#5c2e0a',
    '--slot-btn-to':   '#d4781a',
    '--slot-btn-text': '#1f0e00',
  },
}

// ── Background gradient ────────────────────────────────
const BG_STYLE = {
  background: `
    radial-gradient(ellipse 80% 50% at 50% -5%,
      rgba(90,45,10,0.4) 0%, transparent 70%),
    var(--bg-deep)
  `,
}

export default function WildWestPage() {
  const { reels, spinning, lastResult, history, betAmount, setBetAmount, spin, loadHistory } =
    useSlotMachine({ symbols: WILDWEST_SYMBOLS, paytable: WILDWEST_PAYTABLE, gameName: 'wild_west' })

  useEffect(() => { loadHistory() }, [loadHistory])

  return (
    <div className="game-page" style={BG_STYLE}>
      <div className="game-page__inner">

        <Link to="/" className="back-link">← Back to Lobby</Link>

        {/* Header */}
        <div className="game-header" style={{ '--slot-accent': 'var(--amber)' }}>
          <h1 style={{ color: 'var(--amber)', textShadow: '0 0 30px rgba(255,140,0,0.5)' }}>
            🤠 Wild West
          </h1>
          <p>Draw your hand, partner. Fortune favors the bold.</p>
        </div>

        {/* Slot Machine */}
        <SlotMachine
          symbols={WILDWEST_SYMBOLS}
          paytable={WILDWEST_PAYTABLE}
          gameName="wild_west"
          theme={WILDWEST_THEME}
        />

        {/* Paytable */}
        <div style={{ marginTop: '2rem' }}>
          <p style={{
            fontSize: '0.75rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: '0.75rem'
          }}>Paytable</p>
          <Paytable paytable={WILDWEST_PAYTABLE} />
        </div>

        {/* History */}
        <GameHistory history={history} />

      </div>
    </div>
  )
}
