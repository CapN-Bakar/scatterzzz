// src/hooks/useSlotMachine.js  (v2 — with audio integration)
// ═══════════════════════════════════════════════════════════════
// Shared slot machine logic for Lucky Leprechaun & Wild West.
// v2 changes:
//   - Integrates audio system
//   - Game-specific sound hooks (gameName drives SFX choice)
//   - Jackpot multiplier capped at 20× (was 25×)
//   - Minor RNG fix: use crypto.getRandomValues
// ═══════════════════════════════════════════════════════════════
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import { audio } from '../lib/audioSystem'

// Crypto-quality RNG
function rng() {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] / (0xffffffff + 1)
}

function weightedPick(symbols) {
  const total = symbols.reduce((s, sym) => s + (sym.weight ?? 1), 0)
  let r = rng() * total
  for (const sym of symbols) { r -= sym.weight ?? 1; if (r <= 0) return sym }
  return symbols[symbols.length - 1]
}

// Evaluate 3-reel result
function evaluateSpin(reels, paytable) {
  const [a, b, c] = reels.map(s => s.id)

  if (a === b && b === c) {
    const entry = paytable.find(p => p.match === 'triple' && p.symbol === a)
    if (entry) return { result: 'jackpot', multiplier: Math.min(entry.multiplier, 20), label: entry.label }
    return { result: 'win', multiplier: 5, label: 'Triple!' }
  }

  if (a === b || b === c || a === c) {
    const matchSym = a === b ? a : b === c ? b : a
    const entry = paytable.find(p => p.match === 'pair' && p.symbol === matchSym)
    if (entry) return { result: 'win', multiplier: entry.multiplier, label: entry.label }
    return { result: 'win', multiplier: 1.5, label: 'Pair!' }
  }

  return { result: 'lose', multiplier: 0, label: 'No match' }
}

// Play game-specific SFX based on outcome
function playSlotSFX(gameName, result) {
  // NO sound on loss
  if (result === 'lose') return

  if (gameName === 'lucky_leprechaun') {
    if (result === 'jackpot') audio.playJackpot()
    else if (result === 'win') audio.playIrishJingle()
  } else if (gameName === 'wild_west') {
    if (result === 'jackpot') { audio.playGunshot(); setTimeout(() => audio.playJackpot(), 300) }
    else if (result === 'win') { audio.playCoinSpin(); setTimeout(() => audio.playSmallWin(), 150) }
  }
}

// ── Main hook ─────────────────────────────────────────────────
export function useSlotMachine({ symbols, paytable, gameName }) {
  const { user } = useAuth()
  const { balance, placeBet, addWinnings } = useWallet()

  const [reels,      setReels]      = useState([symbols[0], symbols[1], symbols[2]])
  const [spinning,   setSpinning]   = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [history,    setHistory]    = useState([])
  const [betAmount,  setBetAmount]  = useState(10)

  const loadHistory = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('game_history').select('*')
      .eq('user_id', user.id).eq('game', gameName)
      .order('created_at', { ascending: false }).limit(10)
    if (data) setHistory(data)
  }, [user, gameName])

  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return
    const success = await placeBet(betAmount)
    if (!success) return

    // Spin SFX
    audio.playSpin()
    setSpinning(true)
    setLastResult(null)

    await new Promise(r => setTimeout(r, 1800))

    const newReels = [weightedPick(symbols), weightedPick(symbols), weightedPick(symbols)]
    setReels(newReels)

    const { result, multiplier, label } = evaluateSpin(newReels, paytable)
    const payout = result !== 'lose' ? Math.floor(betAmount * multiplier) : 0

    if (payout > 0) await addWinnings(payout, `${gameName} ${label}`)

    // Play result SFX (no sound on lose)
    playSlotSFX(gameName, result)

    const resultObj = { result, multiplier, label, payout, betAmount, symbols: newReels.map(s => s.id) }
    setLastResult(resultObj)

    if (user) {
      await supabase.from('game_history').insert({
        user_id: user.id, game: gameName, bet_amount: betAmount,
        result, symbols: newReels.map(s => s.id), payout,
      })
      loadHistory()
    }

    setSpinning(false)
  }, [spinning, betAmount, balance, placeBet, addWinnings, symbols, paytable, gameName, user, loadHistory])

  return {
    reels, spinning, lastResult, history,
    betAmount, setBetAmount, spin, loadHistory,
  }
}
