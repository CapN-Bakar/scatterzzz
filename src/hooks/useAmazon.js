// src/hooks/useAmazon.js
// ═══════════════════════════════════════════════════════════════════
// AMAZON — Jungle / Poseidon Theme
// 4×4 grid, cluster wins, vine spread mechanic, animal specials,
// Jungle Frenzy bonus (5 free spins with boosted wilds)
//
// UNIQUE MECHANIC: "VINE SPREAD"
//   1. After a cluster win, random surviving tiles become VINE tiles
//   2. Vine tiles: on the next cascade/refill, they spread to ONE
//      adjacent empty tile and convert the tile to a vine
//   3. Vine matches: vine tiles match each other AND act as wilds
//      (so they help form clusters AND spread)
//   4. This creates a "creeping" effect where wins can snowball
//      organically across multiple rounds
//   5. BALANCE: Vine spawn chance is low (8% per surviving tile)
//      Vines have value=0 (no direct payout, just cluster utility)
//
// ANIMAL SPECIALS:
//   - MONKEY 🐒: When monkey is part of a winning cluster,
//     applies a random multiplier 1.2×–2.0× to THAT cluster payout
//   - SNAKE 🐍:  When snake is part of a winning cluster,
//     removes 2 additional random non-winning tiles from the board
//     (mini-cascade trigger, can chain into new matches)
//
// JUNGLE FRENZY BONUS:
//   - Triggers when 3+ scatter butterflies (🦋) appear
//   - 5 free spins with 20% wild tile injection each spin
//   - Normal bet deduction during free spins
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import { audio } from '../lib/audioSystem'

// ── Symbol definitions ────────────────────────────────────────────
export const AMAZON_SYMBOLS = [
  { id: 'leaf',    emoji: '🍃', label: 'Leaf',    weight: 8,   value: 0.4  },
  { id: 'parrot',  emoji: '🦜', label: 'Parrot',  weight: 6,   value: 0.7  },
  { id: 'snake',   emoji: '🐍', label: 'Snake',   weight: 4,   value: 1.2, special: 'cascade' },
  { id: 'monkey',  emoji: '🐒', label: 'Monkey',  weight: 3,   value: 1.8, special: 'multiplier' },
  { id: 'jaguar',  emoji: '🐆', label: 'Jaguar',  weight: 1.5, value: 3.0  },
  { id: 'gem',     emoji: '💎', label: 'Gem',     weight: 0.5, value: 5.0  },
  { id: 'scatter', emoji: '🦋', label: 'Butterfly',weight: 0.4, value: 0   },
  { id: 'vine',    emoji: '🌿', label: 'Vine',    weight: 0,   value: 0, special: 'vine' },
  { id: 'wild',    emoji: '🌺', label: 'Wild',    weight: 0,   value: 0    }, // frenzy only
]

const SYM_MAP        = Object.fromEntries(AMAZON_SYMBOLS.map(s => [s.id, s]))
const NORMAL_POOL    = AMAZON_SYMBOLS.filter(s => s.weight > 0)
const GRID_SIZE      = 4
const MIN_CLUSTER    = 3
const SCATTER_THRESH = 3
const VINE_SPAWN_P   = 0.08   // 8% chance per surviving tile to become vine
const MAX_PAYOUT_MULT = 40    // cap at 40× bet (lower than bigger games)
const FRENZY_SPINS   = 5
const FRENZY_WILD_P  = 0.20   // 20% wild injection per tile during frenzy

function rng() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / (0xffffffff + 1) }

function pick(pool) {
  const total = pool.reduce((s, sym) => s + sym.weight, 0)
  let r = rng() * total
  for (const sym of pool) { r -= sym.weight; if (r <= 0) return sym }
  return pool[pool.length - 1]
}

// ── Grid generation ───────────────────────────────────────────────
export function generateAmazonGrid(frenzy = false) {
  return Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => {
      let symbol
      if (frenzy && rng() < FRENZY_WILD_P) {
        symbol = SYM_MAP['wild']
      } else {
        symbol = pick(NORMAL_POOL)
      }
      return {
        id: `${r}-${c}-${Date.now()}-${rng()}`,
        symbol, row: r, col: c, state: 'idle',
      }
    })
  )
}

// ── BFS cluster detection ─────────────────────────────────────────
export function findAmazonClusters(grid) {
  const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false))
  const clusters = []

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (visited[r][c]) continue
      const cell = grid[r][c]
      if (!cell?.symbol) continue
      const symId = cell.symbol.id
      // Skip specials as roots (they can JOIN clusters but not start them)
      if (symId === 'scatter') { visited[r][c] = true; continue }

      // vine and wild match anything
      const isSpecial = symId === 'vine' || symId === 'wild'
      if (isSpecial) { visited[r][c] = true; continue } // handled as connectors

      const cluster = []
      const queue = [[r, c]]
      visited[r][c] = true

      while (queue.length) {
        const [cr, cc] = queue.shift()
        cluster.push({ row: cr, col: cc })
        for (const [nr, nc] of [[cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]]) {
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue
          if (visited[nr][nc]) continue
          const n = grid[nr][nc]
          if (!n?.symbol) continue
          const nId = n.symbol.id
          if (nId === 'wild' || nId === 'vine' || nId === symId) {
            visited[nr][nc] = true
            queue.push([nr, nc])
          }
        }
      }

      if (cluster.length >= MIN_CLUSTER) {
        clusters.push({
          symbolId: symId,
          cells: cluster,
          hasMonkey: cluster.some(({ row, col }) => grid[row][col].symbol.id === 'monkey'),
          hasSnake:  cluster.some(({ row, col }) => grid[row][col].symbol.id === 'snake'),
        })
      }
    }
  }
  return clusters
}

// ── Size bonus ────────────────────────────────────────────────────
function sizeBonus(len) {
  if (len >= 6) return 2.0
  if (len >= 5) return 1.5
  if (len >= 4) return 1.2
  return 1.0
}

// ── Payout for one round ──────────────────────────────────────────
export function calcAmazonPayout(clusters, bet) {
  let total = 0
  for (const { symbolId, cells, hasMonkey } of clusters) {
    const sym = SYM_MAP[symbolId]
    if (!sym || sym.value === 0) continue
    let payout = bet * sym.value * sizeBonus(cells.length)
    if (hasMonkey) {
      // Monkey multiplier: 1.2× to 2.0×
      const monkeyMult = 1.2 + rng() * 0.8
      payout *= monkeyMult
      audio.playMonkey()
    }
    total += payout
  }
  return Math.floor(total)
}

// ── Count scatters ────────────────────────────────────────────────
function countScatters(grid) {
  let n = 0
  grid.forEach(row => row.forEach(c => { if (c?.symbol?.id === 'scatter') n++ }))
  return n
}

// ── Gravity: tiles fall, new ones fill from top ───────────────────
function applyGravityAmazon(grid, matchedCells, vinify = false) {
  const set = new Set(matchedCells.map(({ row, col }) => `${row}-${col}`))
  const newGrid = grid.map(row => row.map(c => ({ ...c, state: 'idle' })))

  // Nullify matched
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (set.has(`${r}-${c}`)) newGrid[r][c] = null

  // Vine spread: surviving tiles have a chance to become vine
  if (vinify) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!newGrid[r][c]) continue
        const id = newGrid[r][c].symbol.id
        if (id === 'scatter' || id === 'vine' || id === 'wild') continue
        if (rng() < VINE_SPAWN_P) {
          newGrid[r][c] = { ...newGrid[r][c], symbol: SYM_MAP['vine'], state: 'vine-spawn' }
        }
      }
    }
  }

  // Gravity per column
  for (let c = 0; c < GRID_SIZE; c++) {
    const col = []
    for (let r = 0; r < GRID_SIZE; r++) if (newGrid[r][c]) col.push({ ...newGrid[r][c], state: 'falling' })
    const needed = GRID_SIZE - col.length
    for (let i = 0; i < needed; i++) {
      col.unshift({
        id: `new-${c}-${i}-${Date.now()}`,
        symbol: pick(NORMAL_POOL),
        row: 0, col: c, state: 'new',
      })
    }
    for (let r = 0; r < GRID_SIZE; r++) { col[r].row = r; newGrid[r][c] = col[r] }
  }

  return newGrid
}

// ── Snake special: remove 2 random non-winning tiles ─────────────
function applySnakeEffect(grid, alreadyMatchedSet) {
  const candidates = []
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (!alreadyMatchedSet.has(`${r}-${c}`) && grid[r][c]?.symbol?.id !== 'scatter')
        candidates.push({ row: r, col: c })

  // Shuffle and pick 2
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  return candidates.slice(0, 2)
}

const delay = ms => new Promise(r => setTimeout(r, ms))

// ── Jungle Frenzy bonus ────────────────────────────────────────────
// Returns { totalWon, grid: finalGrid }
async function runJungleFrenzy(grid, bet, setGrid, setPhase, setBonusSpinsLeft) {
  let currentGrid = grid
  let totalWon    = 0

  for (let spin = FRENZY_SPINS; spin > 0; spin--) {
    setBonusSpinsLeft(spin)
    setPhase('frenzy')

    // Fresh frenzy grid with wilds injected
    currentGrid = generateAmazonGrid(true)
    setGrid(currentGrid)
    await delay(400)

    // Evaluate clusters
    const clusters = findAmazonClusters(currentGrid)
    if (clusters.length > 0) {
      const allMatched = clusters.flatMap(c => c.cells)
      setGrid(currentGrid.map(row => row.map(cell => {
        const isMatch = allMatched.find(m => m.row === cell.row && m.col === cell.col)
        return isMatch ? { ...cell, state: 'matched' } : cell
      })))
      const payout = calcAmazonPayout(clusters, bet)
      totalWon += payout
      audio.playMatch()
      await delay(600)
      currentGrid = applyGravityAmazon(currentGrid, allMatched, false)
      setGrid(currentGrid)
      audio.playTileDrop()
      await delay(400)
    }
  }

  setBonusSpinsLeft(0)
  return { totalWon, grid: currentGrid }
}

// ══════════════════════════════════════════════════════════════════
// Main hook
// ══════════════════════════════════════════════════════════════════
export function useAmazon() {
  const { user } = useAuth()
  const { balance, placeBet, addWinnings } = useWallet()

  const [grid,           setGrid]           = useState(generateAmazonGrid)
  const [betAmount,      setBetAmount]      = useState(10)
  const [spinning,       setSpinning]       = useState(false)
  const [phase,          setPhase]          = useState('idle')
  const [totalPayout,    setTotalPayout]    = useState(0)
  const [matchedCells,   setMatchedCells]   = useState([])
  const [bonusActive,    setBonusActive]    = useState(false)
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(0)
  const [cascadeCount,   setCascadeCount]   = useState(0)
  const [lastResult,     setLastResult]     = useState(null)
  const [history,        setHistory]        = useState([])
  const [vineCount,      setVineCount]      = useState(0)  // display only

  const loadHistory = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('game_history').select('*')
      .eq('user_id', user.id).eq('game', 'amazon')
      .order('created_at', { ascending: false }).limit(8)
    if (data) setHistory(data)
  }, [user])

  // ── Cascade processor ─────────────────────────────────────────
  const processAmazonCascade = useCallback(async (currentGrid, accumulated, cascadeNum) => {
    const clusters = findAmazonClusters(currentGrid)
    if (clusters.length === 0) { setPhase('complete'); setMatchedCells([]); return accumulated }

    const allMatched = clusters.flatMap(c => c.cells)
    setMatchedCells(allMatched)
    setPhase('cascading')
    audio.playCascade(cascadeNum)

    // Highlight
    setGrid(currentGrid.map(row => row.map(cell => {
      const isMatch = allMatched.find(m => m.row === cell.row && m.col === cell.col)
      return isMatch ? { ...cell, state: 'matched' } : cell
    })))

    let roundPayout = calcAmazonPayout(clusters, betAmount)

    // Snake effect: remove extra tiles
    const hasSnake = clusters.some(c => c.hasSnake)
    let extraRemoved = []
    if (hasSnake) {
      const matchedSet = new Set(allMatched.map(({ row, col }) => `${row}-${col}`))
      extraRemoved = applySnakeEffect(currentGrid, matchedSet)
      // Highlight snake-removed tiles differently
      if (extraRemoved.length) {
        audio.playCascade(cascadeNum + 1)
      }
    }

    await delay(700)

    // Apply gravity (with vine spread on cascadeNum > 0)
    const combinedRemoved = [...allMatched, ...extraRemoved]
    const newGrid = applyGravityAmazon(currentGrid, combinedRemoved, cascadeNum > 0)
    setGrid(newGrid)
    setCascadeCount(cascadeNum + 1)
    audio.playTileDrop()

    // Count vines on new grid
    let vines = 0
    newGrid.forEach(row => row.forEach(c => { if (c?.symbol?.id === 'vine') vines++ }))
    setVineCount(vines)
    if (vines > 0) audio.playVineSpread()

    await delay(600)
    return processAmazonCascade(newGrid, accumulated + roundPayout, cascadeNum + 1)
  }, [betAmount])

  // ── Main spin ─────────────────────────────────────────────────
  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return
    const ok = await placeBet(betAmount)
    if (!ok) return

    audio.playSpin()
    setSpinning(true)
    setPhase('spinning')
    setTotalPayout(0)
    setMatchedCells([])
    setBonusActive(false)
    setBonusSpinsLeft(0)
    setCascadeCount(0)
    setVineCount(0)
    setLastResult(null)

    let newGrid = generateAmazonGrid()
    setGrid(newGrid)
    await delay(600)

    const scatters = countScatters(newGrid)
    let totalWon   = 0
    let bonusTrig  = false

    if (scatters >= SCATTER_THRESH) {
      bonusTrig = true
      setBonusActive(true)
      setPhase('bonus')
      audio.playJungleFrenzy()
      await delay(800)

      const { totalWon: frenzyWon, grid: postFrenzyGrid } =
        await runJungleFrenzy(newGrid, betAmount, setGrid, setPhase, setBonusSpinsLeft)
      totalWon += frenzyWon
      newGrid   = postFrenzyGrid
    }

    const cascadeWon = await processAmazonCascade(newGrid, 0, 0)
    totalWon += cascadeWon

    // CAP
    const maxPayout = betAmount * MAX_PAYOUT_MULT
    const cappedWon = Math.min(totalWon, maxPayout)

    if (cappedWon > 0) {
      await addWinnings(cappedWon, `Amazon win`)
      if (cappedWon >= betAmount * 20) audio.playJackpot()
      else if (cappedWon >= betAmount * 5) audio.playBigWin()
      else audio.playSmallWin()
    }

    setTotalPayout(cappedWon)
    const result = cappedWon >= betAmount * 20 ? 'jackpot' : cappedWon > 0 ? 'win' : 'lose'
    setLastResult({ result, payout: cappedWon, bonus: bonusTrig })

    if (user) {
      await supabase.from('game_history').insert({
        user_id: user.id, game: 'amazon', bet_amount: betAmount,
        result, symbols: [bonusTrig ? 'frenzy' : 'normal'], payout: cappedWon,
      })
      loadHistory()
    }

    setBonusActive(false)
    setSpinning(false)
    setPhase('idle')
  }, [spinning, betAmount, balance, placeBet, addWinnings, user, loadHistory, processAmazonCascade])

  return {
    grid, betAmount, setBetAmount,
    spinning, phase, totalPayout,
    matchedCells, bonusActive, bonusSpinsLeft,
    cascadeCount, vineCount, lastResult, history,
    spin, loadHistory,
    AMAZON_SYMBOLS,
  }
}
