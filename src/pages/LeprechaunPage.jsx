// src/pages/LeprechaunPage.jsx
// ─────────────────────────────────────────────
// Lucky Leprechaun — Irish-themed slot machine.
// Theme: forest green, gold, magical shimmer.
// ─────────────────────────────────────────────
import { Link } from 'react-router-dom'
import SlotMachine, { Paytable, GameHistory } from '../components/games/SlotMachine'
import { useSlotMachine } from '../hooks/useSlotMachine'
import { useEffect } from 'react'

// ── Symbol definitions ─────────────────────────────────
// weight: higher = more frequent (rarer symbols = lower weight)
const LEPRECHAUN_SYMBOLS = [
  { id: '🍀', emoji: '🍀', label: 'Clover',      weight: 4 },
  { id: '🪙', emoji: '🪙', label: 'Gold Coin',   weight: 4 },
  { id: '🌈', emoji: '🌈', label: 'Rainbow',     weight: 3 },
  { id: '🎩', emoji: '🎩', label: 'Magic Hat',   weight: 2 },
  { id: '⭐', emoji: '⭐', label: 'Lucky Star',  weight: 2 },
  { id: '💎', emoji: '💎', label: 'Emerald',     weight: 1 }, // rarest
]

// ── Paytable — multipliers per combination ─────────────
const LEPRECHAUN_PAYTABLE = [
  { match: 'triple', symbol: '💎', emoji: '💎', label: '💎 Emerald Jackpot!', multiplier: 25 },
  { match: 'triple', symbol: '🎩', emoji: '🎩', label: '🎩 Hat Trick!',       multiplier: 15 },
  { match: 'triple', symbol: '🌈', emoji: '🌈', label: '🌈 Rainbow Road!',    multiplier: 10 },
  { match: 'triple', symbol: '⭐', emoji: '⭐', label: '⭐ Lucky Stars!',     multiplier: 8  },
  { match: 'triple', symbol: '🪙', emoji: '🪙', label: '🪙 Pot o\' Gold!',   multiplier: 6  },
  { match: 'triple', symbol: '🍀', emoji: '🍀', label: '🍀 Clover Luck!',    multiplier: 4  },
  { match: 'pair',   symbol: '💎', emoji: '💎', label: 'Diamond Pair',       multiplier: 3  },
  { match: 'pair',   symbol: '🎩', emoji: '🎩', label: 'Hat Pair',           multiplier: 2  },
  { match: 'pair',   symbol: '🌈', emoji: '🌈', label: 'Rainbow Pair',       multiplier: 2  },
]

// ── Theme config ───────────────────────────────────────
const LEPRECHAUN_THEME = {
  coinEmoji: '🍀',
  cssVars: {
    '--slot-accent':   '#39c466',
    '--slot-glow':     'rgba(57, 196, 102, 0.35)',
    '--slot-btn-from': '#1a5c2a',
    '--slot-btn-to':   '#2ecc71',
    '--slot-btn-text': '#0a1f0d',
  },
}

// ── Background gradient ────────────────────────────────
const BG_STYLE = {
  background: `
    radial-gradient(ellipse 80% 50% at 50% -5%,
      rgba(30,90,40,0.35) 0%, transparent 70%),
    var(--bg-deep)
  `,
}

export default function LeprechaunPage() {
  const { reels, spinning, lastResult, history, betAmount, setBetAmount, spin, loadHistory } =
    useSlotMachine({ symbols: LEPRECHAUN_SYMBOLS, paytable: LEPRECHAUN_PAYTABLE, gameName: 'lucky_leprechaun' })

  useEffect(() => { loadHistory() }, [loadHistory])

  return (
    <div className="game-page" style={BG_STYLE}>
      <div className="game-page__inner">

        <Link to="/" className="back-link">← Back to Lobby</Link>

        {/* Header */}
        <div className="game-header">
          <h1>🍀 Lucky Leprechaun</h1>
          <p>Match magical Irish symbols to win chips!</p>
        </div>

        {/* Slot Machine */}
        <SlotMachine
          symbols={LEPRECHAUN_SYMBOLS}
          paytable={LEPRECHAUN_PAYTABLE}
          gameName="lucky_leprechaun"
          theme={LEPRECHAUN_THEME}
        />

        {/* Paytable */}
        <div style={{ marginTop: '2rem' }}>
          <p style={{
            fontSize: '0.75rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: '0.75rem'
          }}>Paytable</p>
          <Paytable paytable={LEPRECHAUN_PAYTABLE} />
        </div>

        {/* History */}
        <GameHistory history={history} />

      </div>
    </div>
  )
}
