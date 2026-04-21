// src/hooks/useMaximus.js
// ─────────────────────────────────────────────────────────────────
// MAXIMUS — Zeus/Lightning Theme
// 5x5 grid, cluster-based wins, cascade system, lightning wilds,
// scatter-triggered bonus, multiplier chains.
// ─────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import { audio } from '../lib/audioSystem'

// ── Symbol definitions ─────────────────────────────────────────
export const MAXIMUS_SYMBOLS = [
  { id: 'bolt',    emoji: '⚡', label: 'Lightning Bolt', weight: 5, value: 1   },
  { id: 'cloud',   emoji: '☁️', label: 'Storm Cloud',    weight: 5, value: 1.5 },
  { id: 'eagle',   emoji: '🦅', label: 'Eagle',          weight: 4, value: 2   },
  { id: 'helmet',  emoji: '⛩️', label: 'Zeus Helm',      weight: 3, value: 3   },
  { id: 'trident', emoji: '🔱', label: 'Trident',        weight: 2, value: 5   },
  { id: 'orb',     emoji: '🌟', label: 'Power Orb',      weight: 1, value: 8   },
  { id: 'wild',    emoji: '⚡🔥', label: 'Wild',         weight: 0, value: 0   }, // spawned only
  { id: 'scatter', emoji: '🌩️', label: 'Scatter',        weight: 1, value: 0   },
]

// Map id → symbol object
const SYM_MAP = Object.fromEntries(MAXIMUS_SYMBOLS.map(s => [s.id, s]))

const GRID_SIZE = 5
const MIN_CLUSTER = 3
const SCATTER_THRESHOLD = 3 // 3+ scatters → bonus

// ── RNG ──────────────────────────────────────────────────────────
function rng() {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] / (0xffffffff + 1)
}

function weightedPick(symbols) {
  const pool = symbols.filter(s => s.weight > 0)
  const total = pool.reduce((s, sym) => s + sym.weight, 0)
  let r = rng() * total
  for (const sym of pool) {
    r -= sym.weight
    if (r <= 0) return sym
  }
  return pool[pool.length - 1]
}

// ── Generate a fresh 5x5 grid ────────────────────────────────────
export function generateGrid() {
  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => ({
      id: `${row}-${col}-${Date.now()}-${Math.random()}`,  // unique React key
      symbol: weightedPick(MAXIMUS_SYMBOLS),
      row, col,
      state: 'idle',  // 'idle' | 'matched' | 'falling' | 'new' | 'wild' | 'scatter-glow'
    }))
  )
}

// ── BFS cluster detection ────────────────────────────────────────
// Returns array of clusters: [{ symbolId, cells: [{row,col},...] }]
export function findClusters(grid) {
  const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false))
  const clusters = []

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (visited[r][c]) continue
      const cell = grid[r][c]
      if (!cell || !cell.symbol) continue

      const symId = cell.symbol.id
      if (symId === 'wild' || symId === 'scatter') { visited[r][c] = true; continue }

      // BFS — wilds match any symbol
      const cluster = []
      const queue = [[r, c]]
      visited[r][c] = true

      while (queue.length) {
        const [cr, cc] = queue.shift()
        cluster.push({ row: cr, col: cc })

        // 4-directional neighbors
        const neighbors = [[cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]]
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue
          if (visited[nr][nc]) continue
          const neighbor = grid[nr][nc]
          if (!neighbor?.symbol) continue
          const nId = neighbor.symbol.id
          // Wilds connect to anything; match same symbol
          if (nId === 'wild' || nId === symId) {
            visited[nr][nc] = true
            queue.push([nr, nc])
          }
        }
      }

      if (cluster.length >= MIN_CLUSTER) {
        clusters.push({ symbolId: symId, cells: cluster })
      }
    }
  }
  return clusters
}

// ── Count scatter symbols ─────────────────────────────────────────
export function countScatters(grid) {
  let count = 0
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c]?.symbol?.id === 'scatter') count++
  return count
}

// ── Calculate payout from clusters ───────────────────────────────
export function calculateClusterPayout(clusters, betAmount, multiplier = 1) {
  let total = 0
  for (const { symbolId, cells } of clusters) {
    const sym = SYM_MAP[symbolId]
    if (!sym) continue
    // Payout = bet × symbol_value × cluster_size_bonus × multiplier
    const sizeMult = cells.length >= 8 ? 3 : cells.length >= 6 ? 2 : cells.length >= 5 ? 1.5 : 1
    total += betAmount * sym.value * sizeMult * multiplier
  }
  return Math.floor(total)
}

// ── Remove matched cells and apply gravity (tiles fall down) ─────
// Returns new grid with fallen tiles + newly generated top tiles
export function applyGravity(grid, matchedCells) {
  // Deep clone grid
  const newGrid = grid.map(row => row.map(cell => ({ ...cell, state: 'idle' })))

  // Mark matched cells as empty
  const matchedSet = new Set(matchedCells.map(({ row, col }) => `${row}-${col}`))
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (matchedSet.has(`${r}-${c}`)) newGrid[r][c] = null

  // Gravity: for each column, compact non-null cells to bottom
  for (let c = 0; c < GRID_SIZE; c++) {
    const col = []
    for (let r = 0; r < GRID_SIZE; r++) if (newGrid[r][c]) col.push({ ...newGrid[r][c], state: 'falling' })
    // Fill remaining from top with new symbols
    const needed = GRID_SIZE - col.length
    for (let i = 0; i < needed; i++) {
      const newSym = weightedPick(MAXIMUS_SYMBOLS)
      col.unshift({ id: `new-${c}-${i}-${Date.now()}`, symbol: newSym, row: 0, col: c, state: 'new' })
    }
    // Re-assign rows
    for (let r = 0; r < GRID_SIZE; r++) {
      col[r].row = r
      newGrid[r][c] = col[r]
    }
  }

  return newGrid
}

// ── Zeus Bonus: strike random tiles with lightning (turn to wilds) ─
export function applyZeusBonus(grid) {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })))
  // Strike 3–6 random non-scatter cells
  const strikes = 3 + Math.floor(rng() * 4)
  const positions = []
  while (positions.length < strikes) {
    const r = Math.floor(rng() * GRID_SIZE)
    const c = Math.floor(rng() * GRID_SIZE)
    const key = `${r}-${c}`
    if (!positions.find(p => p.key === key)) {
      positions.push({ r, c, key })
      newGrid[r][c] = {
        ...newGrid[r][c],
        symbol: SYM_MAP['wild'],
        state: 'wild',
      }
    }
  }
  return { grid: newGrid, strikePositions: positions }
}

// ── Main hook ─────────────────────────────────────────────────────
export function useMaximus() {
  const { user } = useAuth()
  const { balance, placeBet, addWinnings } = useWallet()

  const [grid, setGrid] = useState(() => generateGrid())
  const [betAmount, setBetAmount] = useState(10)
  const [spinning, setSpinning] = useState(false)
  const [phase, setPhase] = useState('idle') // idle|spinning|cascading|bonus|complete
  const [multiplier, setMultiplier] = useState(1)
  const [totalPayout, setTotalPayout] = useState(0)
  const [matchedCells, setMatchedCells] = useState([])
  const [bonusActive, setBonusActive] = useState(false)
  const [lightningPositions, setLightningPositions] = useState([])
  const [cascadeCount, setCascadeCount] = useState(0)
  const [lastResult, setLastResult] = useState(null)
  const [history, setHistory] = useState([])

  const cascadeRef = useRef(null)

  // ── Load history ──────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('game_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('game', 'maximus')
      .order('created_at', { ascending: false })
      .limit(8)
    if (data) setHistory(data)
  }, [user])

  // ── Process cascade chain ─────────────────────────────────────
  const processCascade = useCallback(async (currentGrid, currentMultiplier, accumulated, cascadeNum) => {
    const clusters = findClusters(currentGrid)

    if (clusters.length === 0) {
      // No more matches — cascade chain ends
      setPhase('complete')
      setMatchedCells([])
      return accumulated
    }

    // Highlight matched cells
    const allMatched = clusters.flatMap(c => c.cells)
    setMatchedCells(allMatched)
    setPhase('cascading')
    audio.playCascade(cascadeNum)

    // Mark matched tiles
    const highlightedGrid = currentGrid.map(row => row.map(cell => {
      const isMatch = allMatched.find(m => m.row === cell.row && m.col === cell.col)
      return isMatch ? { ...cell, state: 'matched' } : cell
    }))
    setGrid(highlightedGrid)

    const roundPayout = calculateClusterPayout(clusters, accumulated > 0 ? betAmount : betAmount, currentMultiplier)

    await delay(700) // show matched state

    // Apply gravity
    const newGrid = applyGravity(currentGrid, allMatched)
    setGrid(newGrid)
    setMultiplier(currentMultiplier)
    setCascadeCount(cascadeNum)
    audio.playTileDrop()

    await delay(600) // tiles fall

    const nextMultiplier = currentMultiplier + (cascadeNum > 0 ? 1 : 0)

    // Recurse
    const total = accumulated + roundPayout
    return processCascade(newGrid, nextMultiplier, total, cascadeNum + 1)
  }, [betAmount])

  // ── Main spin action ──────────────────────────────────────────
  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return
    const success = await placeBet(betAmount)
    if (!success) return

    audio.playSpin()
    setSpinning(true)
    setPhase('spinning')
    setMultiplier(1)
    setTotalPayout(0)
    setMatchedCells([])
    setCascadeCount(0)
    setBonusActive(false)
    setLightningPositions([])
    setLastResult(null)

    // Generate new grid
    let newGrid = generateGrid()
    setGrid(newGrid)
    await delay(600) // spin animation

    // Check for scatter bonus
    const scatterCount = countScatters(newGrid)
    let bonusGrid = newGrid
    let bonusTriggered = false

    if (scatterCount >= SCATTER_THRESHOLD) {
      setBonusActive(true)
      bonusTriggered = true
      audio.playZeusBonus()
      setPhase('bonus')
      await delay(800)

      const { grid: bGrid, strikePositions } = applyZeusBonus(newGrid)
      bonusGrid = bGrid
      setGrid(bGrid)
      setLightningPositions(strikePositions)
      audio.playLightning()
      await delay(1000)
      setLightningPositions([])
    }

    // Run cascade chain
    const totalWon = await processCascade(bonusGrid, 1, 0, 0)

    // Award winnings
    if (totalWon > 0) {
      await addWinnings(totalWon, `Maximus: ${cascadeCount} cascades`)
      if (totalWon >= betAmount * 20) audio.playJackpot()
      else if (totalWon >= betAmount * 5) audio.playBigWin()
      else audio.playSmallWin()
    }

    setTotalPayout(totalWon)
    const resultStr = totalWon > 0 ? (totalWon >= betAmount * 10 ? 'jackpot' : 'win') : 'lose'
    setLastResult({ result: resultStr, payout: totalWon, multiplier })

    // Save to Supabase
    if (user) {
      await supabase.from('game_history').insert({
        user_id: user.id,
        game: 'maximus',
        bet_amount: betAmount,
        result: resultStr,
        symbols: [scatterCount >= SCATTER_THRESHOLD ? 'bonus' : 'normal'],
        payout: totalWon,
      })
      loadHistory()
    }

    setSpinning(false)
    setPhase('idle')
  }, [spinning, betAmount, balance, placeBet, addWinnings, user, loadHistory, processCascade, multiplier, cascadeCount])

  return {
    grid, betAmount, setBetAmount,
    spinning, phase, multiplier, totalPayout,
    matchedCells, bonusActive, lightningPositions,
    cascadeCount, lastResult, history,
    spin, loadHistory,
  }
}

// ── Utility ───────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
