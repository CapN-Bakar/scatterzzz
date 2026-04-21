// src/pages/LeprechaunPage.jsx  (v2 — with audio)
// Add these changes to your existing LeprechaunPage:
//
//   1. Import audio and AudioControls
//   2. Add useEffect to start/stop BGM
//   3. Add <AudioControls /> to return
//
// ── Patch (add to imports) ─────────────────────────────────────
//   import { audio } from '../lib/audioSystem'
//   import AudioControls from '../components/AudioControls'
//
// ── Patch (add inside component, after useSlotMachine call) ────
//   useEffect(() => {
//     audio.playBGMLeprechaun()
//     return () => audio.stopBGM()
//   }, [])
//
// ── Patch (add at bottom of JSX return, inside outer div) ──────
//   <AudioControls theme="default" />
//
// ═══════════════════════════════════════════════════════════════
// Full updated file shown below for copy/paste convenience:
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SlotMachine, { Paytable, GameHistory } from '../components/games/SlotMachine'
import { useSlotMachine } from '../hooks/useSlotMachine'
import { audio } from '../lib/audioSystem'
import AudioControls from '../components/AudioControls'

const LEPRECHAUN_SYMBOLS = [
  { id: '🍀', emoji: '🍀', label: 'Clover',     weight: 4 },
  { id: '🪙', emoji: '🪙', label: 'Gold Coin',  weight: 4 },
  { id: '🌈', emoji: '🌈', label: 'Rainbow',    weight: 3 },
  { id: '🎩', emoji: '🎩', label: 'Magic Hat',  weight: 2 },
  { id: '⭐', emoji: '⭐', label: 'Lucky Star', weight: 2 },
  { id: '💎', emoji: '💎', label: 'Emerald',    weight: 1 },
]

const LEPRECHAUN_PAYTABLE = [
  { match: 'triple', symbol: '💎', emoji: '💎', label: '💎 Emerald Jackpot!', multiplier: 20 }, // was 25
  { match: 'triple', symbol: '🎩', emoji: '🎩', label: '🎩 Hat Trick!',       multiplier: 15 },
  { match: 'triple', symbol: '🌈', emoji: '🌈', label: '🌈 Rainbow Road!',    multiplier: 10 },
  { match: 'triple', symbol: '⭐', emoji: '⭐', label: '⭐ Lucky Stars!',     multiplier: 8  },
  { match: 'triple', symbol: '🪙', emoji: '🪙', label: '🪙 Pot o\' Gold!',   multiplier: 6  },
  { match: 'triple', symbol: '🍀', emoji: '🍀', label: '🍀 Clover Luck!',    multiplier: 4  },
  { match: 'pair',   symbol: '💎', emoji: '💎', label: 'Diamond Pair',       multiplier: 3  },
  { match: 'pair',   symbol: '🎩', emoji: '🎩', label: 'Hat Pair',           multiplier: 2  },
  { match: 'pair',   symbol: '🌈', emoji: '🌈', label: 'Rainbow Pair',       multiplier: 2  },
]

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

const BG_STYLE = {
  background: `radial-gradient(ellipse 80% 50% at 50% -5%,
    rgba(30,90,40,0.35) 0%, transparent 70%), var(--bg-deep)`,
}

export default function LeprechaunPage() {
  const { reels, spinning, lastResult, history, betAmount, setBetAmount, spin, loadHistory } =
    useSlotMachine({
      symbols: LEPRECHAUN_SYMBOLS,
      paytable: LEPRECHAUN_PAYTABLE,
      gameName: 'lucky_leprechaun',
    })

  useEffect(() => {
    loadHistory()
    audio.playBGMLeprechaun()
    return () => audio.stopBGM()
  }, [loadHistory])

  return (
    <div className="game-page" style={BG_STYLE}>
      <div className="game-page__inner">
        <Link to="/" className="back-link">← Back to Lobby</Link>
        <div className="game-header">
          <h1>🍀 Lucky Leprechaun</h1>
          <p>Match magical Irish symbols to win chips!</p>
        </div>
        <SlotMachine
          symbols={LEPRECHAUN_SYMBOLS}
          paytable={LEPRECHAUN_PAYTABLE}
          gameName="lucky_leprechaun"
          theme={LEPRECHAUN_THEME}
        />
        <div style={{ marginTop: '2rem' }}>
          <p style={{ fontSize:'0.75rem', fontWeight:800, textTransform:'uppercase',
            letterSpacing:'0.1em', color:'var(--text-muted)', marginBottom:'0.75rem' }}>
            Paytable
          </p>
          <Paytable paytable={LEPRECHAUN_PAYTABLE} />
        </div>
        <GameHistory history={history} />
      </div>
      <AudioControls theme="default" />
    </div>
  )
}
