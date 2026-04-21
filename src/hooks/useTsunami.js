// src/hooks/useTsunami.js
// ─────────────────────────────────────────────────────────────────
// TSUNAMI — Poseidon/Ocean Theme
// Unique mechanic: TIDAL SHIFT SYSTEM
//
// How it works:
//   1. 5x5 grid of sea symbols
//   2. Player spins → grid is analyzed for matches (rows of 3+ in a row)
//   3. Winning rows cause a "tidal shift" — each winning row shifts LEFT by 1
//      and a new symbol washes in from the right
//   4. New symbols from the "wave" can create more matches (chain reaction)
//   5. Wins fill the WATER METER (0→100%)
//   6. When water meter reaches 100% → TSUNAMI BONUS triggers:
//      Poseidon appears, transforms entire grid, guaranteed massive win
//   7. Bonus resets meter to 0
// ─────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import { audio } from '../lib/audioSystem'

// ── Symbol set ────────────────────────────────────────────────────
export const TSUNAMI_SYMBOLS = [
  { id: 'wave',     emoji: '🌊', label: 'Wave',        weight: 5, value: 1   },
  { id: 'fish',     emoji: '🐠', label: 'Fish',        weight: 5, value: 1.5 },
  { id: 'shell',    emoji: '🐚', label: 'Shell',       weight: 4, value: 2   },
  { id: 'coral',    emoji: '🪸', label: 'Coral',       weight: 3, value: 3   },
  { id: 'kraken',   emoji: '🦑', label: 'Kraken',      weight: 2, value: 5   },
  { id: 'pearl',    emoji: '🫧', label: 'Pearl',       weight: 1, value: 8   },
  { id: 'wild',     emoji: '🔱', label: 'Trident Wild',weight: 0, value: 0   }, // spawned
  { id: 'scatter',  emoji: '🌀', label: 'Whirlpool',   weight: 1, value: 0   }, // scatter
  { id: 'poseidon', emoji: '🧜', label: 'Poseidon',    weight: 0, value: 0   }, // bonus only
]

const SYM_MAP = Object.fromEntries(TSUNAMI_SYMBOLS.map(s => [s.id, s]))
const GRID_ROWS = 5
const GRID_COLS = 5

// ── RNG ───────────────────────────────────────────────────────────
function rng() {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] / (0xffffffff + 1)
}

function weightedPick(symbols = TSUNAMI_SYMBOLS) {
  const pool = symbols.filter(s => s.weight > 0)
  const total = pool.reduce((s, sym) => s + sym.weight, 0)
  let r = rng() * total
  for (const sym of pool) { r -= sym.weight; if (r <= 0) return sym }
  return pool[pool.length - 1]
}

// ── Generate fresh grid ───────────────────────────────────────────
export function generateTsunamiGrid() {
  return Array.from({ length: GRID_ROWS }, (_, r) =>
    Array.from({ length: GRID_COLS }, (_, c) => ({
      key: `${r}-${c}-${Date.now()}-${rng()}`,
      symbol: weightedPick(),
      row: r, col: c,
      state: 'idle', // idle|matched|shifting|new|wild|poseidon
    }))
  )
}

// ── Row match detection (3+ consecutive same in a row) ────────────
// Returns array of { row, cols: [c0,c1,...], symbolId, length }
export function findRowMatches(grid) {
  const matches = []

  for (let r = 0; r < GRID_ROWS; r++) {
    let c = 0
    while (c < GRID_COLS) {
      const cell = grid[r][c]
      if (!cell?.symbol) { c++; continue }
      const symId = cell.symbol.id
      if (symId === 'scatter') { c++; continue }

      let runLen = 1
      while (
        c + runLen < GRID_COLS &&
        grid[r][c + runLen]?.symbol &&
        (grid[r][c + runLen].symbol.id === symId ||
         grid[r][c + runLen].symbol.id === 'wild' ||
         symId === 'wild')
      ) runLen++

      if (runLen >= 3) {
        matches.push({
          row: r,
          cols: Array.from({ length: runLen }, (_, i) => c + i),
          symbolId: symId === 'wild' ? (grid[r][c+1]?.symbol?.id ?? symId) : symId,
          length: runLen,
        })
        c += runLen
      } else c++
    }
  }
  return matches
}

// ── Also check columns (vertical matches) ────────────────────────
export function findColMatches(grid) {
  const matches = []
  for (let c = 0; c < GRID_COLS; c++) {
    let r = 0
    while (r < GRID_ROWS) {
      const cell = grid[r][c]
      if (!cell?.symbol) { r++; continue }
      const symId = cell.symbol.id
      if (symId === 'scatter') { r++; continue }
      let runLen = 1
      while (
        r + runLen < GRID_ROWS &&
        grid[r + runLen][c]?.symbol &&
        (grid[r + runLen][c].symbol.id === symId || grid[r + runLen][c].symbol.id === 'wild')
      ) runLen++
      if (runLen >= 3) {
        matches.push({
          col: c,
          rows: Array.from({ length: runLen }, (_, i) => r + i),
          symbolId: symId,
          length: runLen,
          isCol: true,
        })
        r += runLen
      } else r++
    }
  }
  return matches
}

// ── Calculate payout ──────────────────────────────────────────────
export function calcMatchPayout(matches, betAmount) {
  return Math.floor(
    matches.reduce((sum, m) => {
      const sym = SYM_MAP[m.symbolId]
      if (!sym) return sum
      const lenBonus = m.length === 5 ? 4 : m.length === 4 ? 2.5 : 1
      return sum + betAmount * sym.value * lenBonus
    }, 0)
  )
}

// ── Tidal Shift: shift matching rows left, wash new tile from right ─
// matchedRows: array of row indices that had matches
export function applyTidalShift(grid, matchedRowIndices) {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell, state: 'idle' })))

  for (const r of matchedRowIndices) {
    // Shift entire row left by 1 (first cell drops off)
    for (let c = 0; c < GRID_COLS - 1; c++) {
      newGrid[r][c] = {
        ...newGrid[r][c + 1],
        col: c,
        state: 'shifting',
      }
    }
    // New tile washes in from right
    const newSym = weightedPick()
    newGrid[r][GRID_COLS - 1] = {
      key: `shift-${r}-${Date.now()}`,
      symbol: newSym,
      row: r,
      col: GRID_COLS - 1,
      state: 'new',
    }
  }

  return newGrid
}

// ── Poseidon Tsunami: transform entire board ──────────────────────
export function applyTsunamiBonus(grid) {
  // Every cell becomes a high-value symbol (coral, kraken, or pearl)
  const highSymbols = TSUNAMI_SYMBOLS.filter(s => s.value >= 3 && s.weight > 0)
  const newGrid = grid.map(row =>
    row.map(cell => ({
      ...cell,
      symbol: highSymbols[Math.floor(rng() * highSymbols.length)],
      state: 'poseidon',
      key: `tsunami-${cell.row}-${cell.col}-${Date.now()}`,
    }))
  )
  // Place Poseidon wilds at center cross
  const center = [[2,2],[1,2],[3,2],[2,1],[2,3]]
  for (const [r, c] of center) {
    newGrid[r][c] = { ...newGrid[r][c], symbol: SYM_MAP['wild'], state: 'wild' }
  }
  return newGrid
}

// ── Main hook ─────────────────────────────────────────────────────
export function useTsunami() {
  const { user } = useAuth()
  const { balance, placeBet, addWinnings } = useWallet()

  const [grid, setGrid] = useState(() => generateTsunamiGrid())
  const [betAmount, setBetAmount] = useState(10)
  const [spinning, setSpinning] = useState(false)
  const [phase, setPhase] = useState('idle') // idle|spinning|matching|shifting|bonus|complete
  const [waterLevel, setWaterLevel] = useState(0) // 0–100
  const [totalPayout, setTotalPayout] = useState(0)
  const [shiftRows, setShiftRows] = useState([])
  const [bonusActive, setBonusActive] = useState(false)
  const [waveCount, setWaveCount] = useState(0)
  const [lastResult, setLastResult] = useState(null)
  const [history, setHistory] = useState([])

  // ── Load history ───────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('game_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('game', 'tsunami')
      .order('created_at', { ascending: false })
      .limit(8)
    if (data) setHistory(data)
  }, [user])

  // ── Process tidal chain ────────────────────────────────────────
  const processWaveChain = useCallback(async (currentGrid, accumulated, wave) => {
    const rowMatches = findRowMatches(currentGrid)
    const colMatches = findColMatches(currentGrid)
    const allMatches = [...rowMatches, ...colMatches]

    if (allMatches.length === 0) return accumulated

    setPhase('matching')
    setWaveCount(wave)
    audio.playMatch()

    // Highlight matched cells
    const matchedSet = new Set()
    rowMatches.forEach(m => m.cols.forEach(c => matchedSet.add(`${m.row}-${c}`)))
    colMatches.forEach(m => m.rows.forEach(r => matchedSet.add(`${r}-${m.col}`)))

    const highlightedGrid = currentGrid.map(row =>
      row.map(cell =>
        matchedSet.has(`${cell.row}-${cell.col}`) ? { ...cell, state: 'matched' } : cell
      )
    )
    setGrid(highlightedGrid)

    const roundPayout = calcMatchPayout(allMatches, betAmount)
    const waterGain = Math.min(25, Math.floor(roundPayout / betAmount * 8))

    await delay(600)

    // Apply tidal shift to matching rows
    const matchedRowIndices = [...new Set([
      ...rowMatches.map(m => m.row),
      ...colMatches.flatMap(m => m.rows),
    ])]
    setShiftRows(matchedRowIndices)
    audio.playWaveCrash()

    const shiftedGrid = applyTidalShift(currentGrid, matchedRowIndices)
    setGrid(shiftedGrid)
    setPhase('shifting')

    // Update water level
    setWaterLevel(prev => Math.min(100, prev + waterGain))
    audio.playWaterRise()

    await delay(700)
    setShiftRows([])

    const total = accumulated + roundPayout
    // Continue chain
    return processWaveChain(shiftedGrid, total, wave + 1)
  }, [betAmount])

  // ── Main spin ─────────────────────────────────────────────────
  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return
    const success = await placeBet(betAmount)
    if (!success) return

    audio.playSpin()
    setSpinning(true)
    setPhase('spinning')
    setTotalPayout(0)
    setShiftRows([])
    setBonusActive(false)
    setWaveCount(0)
    setLastResult(null)

    // New grid
    let newGrid = generateTsunamiGrid()
    setGrid(newGrid)
    await delay(700)

    // Check current water level — if 100, TSUNAMI
    let isTsunami = false
    let bonusGrid = newGrid

    // Read current waterLevel ref value
    let currentWater = 0
    setWaterLevel(prev => { currentWater = prev; return prev })
    await delay(10)

    if (currentWater >= 100) {
      isTsunami = true
      setBonusActive(true)
      setPhase('bonus')
      audio.playTsunamiBonus()
      await delay(1000)

      bonusGrid = applyTsunamiBonus(newGrid)
      setGrid(bonusGrid)
      await delay(1200)
      setWaterLevel(0) // reset
    }

    // Run wave chain
    const totalWon = await processWaveChain(bonusGrid, 0, 0)

    // Award
    if (totalWon > 0) {
      await addWinnings(totalWon, `Tsunami: ${waveCount} waves`)
      if (totalWon >= betAmount * 20) audio.playJackpot()
      else if (totalWon >= betAmount * 5) audio.playBigWin()
      else audio.playSmallWin()
    }

    setTotalPayout(totalWon)
    const resultStr = totalWon > 0 ? (totalWon >= betAmount * 10 ? 'jackpot' : 'win') : 'lose'
    setLastResult({ result: resultStr, payout: totalWon, tsunami: isTsunami })

    if (user) {
      await supabase.from('game_history').insert({
        user_id: user.id,
        game: 'tsunami',
        bet_amount: betAmount,
        result: resultStr,
        symbols: [isTsunami ? 'tsunami-bonus' : 'normal'],
        payout: totalWon,
      })
      loadHistory()
    }

    setPhase('complete')
    setSpinning(false)
    setTimeout(() => setPhase('idle'), 1000)
  }, [spinning, betAmount, balance, placeBet, addWinnings, user, loadHistory, processWaveChain, waveCount])

  return {
    grid, betAmount, setBetAmount,
    spinning, phase, waterLevel,
    totalPayout, shiftRows, bonusActive,
    waveCount, lastResult, history,
    spin, loadHistory,
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
