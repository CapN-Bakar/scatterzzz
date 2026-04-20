// src/hooks/useSlotMachine.js
// ─────────────────────────────────────────────
// Shared slot machine logic for both games.
// Each game passes in its own symbol set and paytable.
// ─────────────────────────────────────────────
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'

// ── RNG: cryptographically better than Math.random ─────
function secureRandom() {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] / (0xffffffff + 1)
}

function pickSymbol(symbols) {
  // Each symbol can have a "weight" for rarity control
  const totalWeight = symbols.reduce((sum, s) => sum + (s.weight ?? 1), 0)
  let rand = secureRandom() * totalWeight
  for (const sym of symbols) {
    rand -= sym.weight ?? 1
    if (rand <= 0) return sym
  }
  return symbols[symbols.length - 1]
}

// ── Evaluate a 3-reel spin ──────────────────────────────
// Returns { result, multiplier, label }
function evaluateSpin(reels, paytable) {
  const [a, b, c] = reels.map(s => s.id)

  // Jackpot: all three match (highest symbol)
  if (a === b && b === c) {
    const entry = paytable.find(p => p.match === 'triple' && p.symbol === a)
    if (entry) return { result: 'jackpot', multiplier: entry.multiplier, label: entry.label }
    // generic triple
    return { result: 'win', multiplier: 5, label: 'Triple!' }
  }

  // Two matching
  if (a === b || b === c || a === c) {
    const matchSym = (a === b) ? a : (b === c) ? b : a
    const entry = paytable.find(p => p.match === 'pair' && p.symbol === matchSym)
    if (entry) return { result: 'win', multiplier: entry.multiplier, label: entry.label }
    return { result: 'win', multiplier: 1.5, label: 'Pair!' }
  }

  return { result: 'lose', multiplier: 0, label: 'No match' }
}

// ── Main hook ───────────────────────────────────────────
export function useSlotMachine({ symbols, paytable, gameName }) {
  const { user } = useAuth()
  const { balance, placeBet, addWinnings } = useWallet()

  const [reels, setReels] = useState([symbols[0], symbols[1], symbols[2]])
  const [spinning, setSpinning] = useState(false)
  const [lastResult, setLastResult] = useState(null) // { result, multiplier, label, payout }
  const [history, setHistory] = useState([])
  const [betAmount, setBetAmount] = useState(10)

  // ── Load game history from Supabase ─────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('game_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('game', gameName)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setHistory(data)
  }, [user, gameName])

  // ── Spin ────────────────────────────────────────────
  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return

    // Deduct bet
    const success = await placeBet(betAmount)
    if (!success) return

    setSpinning(true)
    setLastResult(null)

    // Simulate reel spin delay
    await new Promise(r => setTimeout(r, 1800))

    // Pick random symbols for each reel
    const newReels = [pickSymbol(symbols), pickSymbol(symbols), pickSymbol(symbols)]
    setReels(newReels)

    // Evaluate outcome
    const { result, multiplier, label } = evaluateSpin(newReels, paytable)
    const payout = result !== 'lose' ? Math.floor(betAmount * multiplier) : 0

    // Pay out winnings
    if (payout > 0) {
      await addWinnings(payout, `${gameName} ${label}`)
    }

    const resultObj = { result, multiplier, label, payout, betAmount, symbols: newReels.map(s => s.id) }
    setLastResult(resultObj)

    // Save to game_history
    if (user) {
      await supabase.from('game_history').insert({
        user_id: user.id,
        game: gameName,
        bet_amount: betAmount,
        result,
        symbols: newReels.map(s => s.id),
        payout,
      })
      loadHistory()
    }

    setSpinning(false)
  }, [spinning, betAmount, balance, placeBet, addWinnings, symbols, paytable, gameName, user, loadHistory])

  return {
    reels,
    spinning,
    lastResult,
    history,
    betAmount,
    setBetAmount,
    spin,
    loadHistory,
  }
}
