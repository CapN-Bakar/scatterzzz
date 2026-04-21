// src/hooks/useMaximus.js  — REBALANCED v2
// ═══════════════════════════════════════════════════════════════════
// Key changes from v1:
//   1. Symbol values reduced ~60%
//   2. Scatter weight: 1 → 0.3 (bonus triggers ~4% of spins, was ~15%)
//   3. Cluster size bonuses reduced
//   4. Cascade multiplier CAPPED at 5×
//   5. Single spin payout capped at 50× bet (prevent catastrophic wins)
//   6. Cool-down symbol table: tiles added after cascades are biased low
//   7. Zeus bonus: only 2–4 wilds (was 3–6)
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { audio } from "../lib/audioSystem";

// ── BALANCED symbols ─────────────────────────────────────────────
const SYMBOLS = [
  { id: "bolt", emoji: "⚡", label: "Bolt", weight: 7, value: 0.4 },
  { id: "cloud", emoji: "☁️", label: "Cloud", weight: 6, value: 0.6 },
  { id: "eagle", emoji: "🦅", label: "Eagle", weight: 4, value: 0.9 },
  { id: "helmet", emoji: "⛩️", label: "Helmet", weight: 2.5, value: 1.5 },
  { id: "trident", emoji: "🔱", label: "Trident", weight: 1.2, value: 2.5 },
  { id: "orb", emoji: "🌟", label: "Power Orb", weight: 0.4, value: 4.0 },
  { id: "scatter", emoji: "🌩️", label: "Scatter", weight: 0.3, value: 0 },
];

// "Cool" pool used for tiles added during cascades — biased toward low value
const COOL_SYMBOLS = [
  { id: "bolt", emoji: "⚡", label: "Bolt", weight: 12, value: 0.4 },
  { id: "cloud", emoji: "☁️", label: "Cloud", weight: 10, value: 0.6 },
  { id: "eagle", emoji: "🦅", label: "Eagle", weight: 6, value: 0.9 },
  { id: "helmet", emoji: "⛩️", label: "Helmet", weight: 3, value: 1.5 },
  { id: "trident", emoji: "🔱", label: "Trident", weight: 1, value: 2.5 },
  { id: "orb", emoji: "🌟", label: "Power Orb", weight: 0.2, value: 4.0 },
];

const GRID_SIZE = 5;
const MIN_CLUSTER = 3;
const MAX_MULTI = 5; // cascade multiplier cap
const MAX_PAYOUT_MULT = 50; // single spin payout cap as multiple of bet
const SCATTER_THRESH = 3; // scatters needed for bonus

// ── RNG ───────────────────────────────────────────────────────────
function secureRng() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / (0xffffffff + 1);
}

function pick(pool) {
  const total = pool.reduce((s, sym) => s + sym.weight, 0);
  let r = secureRng() * total;
  for (const sym of pool) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return pool[pool.length - 1];
}

// ── Grid generation ───────────────────────────────────────────────
export function generateGrid() {
  return Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => ({
      id: `${r}-${c}-${Date.now()}-${secureRng()}`,
      symbol: pick(SYMBOLS),
      row: r,
      col: c,
      state: "idle",
    })),
  );
}

// ── BFS cluster detection ─────────────────────────────────────────
export function findClusters(grid) {
  const visited = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(false),
  );
  const clusters = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (visited[r][c]) continue;
      const cell = grid[r][c];
      if (!cell?.symbol) continue;
      const symId = cell.symbol.id;
      if (symId === "wild" || symId === "scatter") {
        visited[r][c] = true;
        continue;
      }

      const cluster = [];
      const queue = [[r, c]];
      visited[r][c] = true;
      while (queue.length) {
        const [cr, cc] = queue.shift();
        cluster.push({ row: cr, col: cc });
        for (const [nr, nc] of [
          [cr - 1, cc],
          [cr + 1, cc],
          [cr, cc - 1],
          [cr, cc + 1],
        ]) {
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
          if (visited[nr][nc]) continue;
          const n = grid[nr][nc];
          if (!n?.symbol) continue;
          if (n.symbol.id === "wild" || n.symbol.id === symId) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }
      if (cluster.length >= MIN_CLUSTER)
        clusters.push({ symbolId: symId, cells: cluster });
    }
  }
  return clusters;
}

// ── Cluster size bonus (reduced from v1) ──────────────────────────
function sizeBonus(len) {
  if (len >= 8) return 2.0; // was 3.0
  if (len >= 6) return 1.5; // was 2.0
  if (len >= 5) return 1.2; // was 1.5
  return 1.0;
}

// ── Payout calculation ────────────────────────────────────────────
export function calcClusterPayout(clusters, bet, multiplier) {
  const SYM_MAP = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
  let total = 0;
  for (const { symbolId, cells } of clusters) {
    const sym = SYM_MAP[symbolId];
    if (!sym) continue;
    total += bet * sym.value * sizeBonus(cells.length) * multiplier;
  }
  return Math.floor(total);
}

// ── Count scatters ────────────────────────────────────────────────
function countScatters(grid) {
  let n = 0;
  grid.forEach((row) =>
    row.forEach((cell) => {
      if (cell?.symbol?.id === "scatter") n++;
    }),
  );
  return n;
}

// ── Gravity + refill (uses COOL_SYMBOLS for new tiles) ────────────
function applyGravity(grid, matchedCells) {
  const set = new Set(matchedCells.map(({ row, col }) => `${row}-${col}`));
  const newGrid = grid.map((row) => row.map((c) => ({ ...c, state: "idle" })));
  for (const c of newGrid)
    c.forEach((cell, i) => {
      if (set.has(`${cell.row}-${cell.col}`))
        newGrid[cell.row][cell.col] = null;
    });

  for (let c = 0; c < GRID_SIZE; c++) {
    const col = [];
    for (let r = 0; r < GRID_SIZE; r++)
      if (newGrid[r][c]) col.push({ ...newGrid[r][c], state: "falling" });
    const needed = GRID_SIZE - col.length;
    for (let i = 0; i < needed; i++) {
      // Use cool pool for cascade refills — biased toward low value
      col.unshift({
        id: `new-${c}-${i}-${Date.now()}`,
        symbol: pick(COOL_SYMBOLS),
        row: 0,
        col: c,
        state: "new",
      });
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      col[r].row = r;
      newGrid[r][c] = col[r];
    }
  }
  return newGrid;
}

// ── Zeus bonus (2–4 wilds, was 3–6) ──────────────────────────────
function applyZeusBonus(grid) {
  const newGrid = grid.map((row) => row.map((c) => ({ ...c })));
  const WILD = {
    id: "wild",
    emoji: "⚡🔥",
    label: "Wild",
    weight: 0,
    value: 0,
  };
  const strikes = 2 + Math.floor(secureRng() * 3); // 2–4 (was 3–6)
  const positions = [];
  while (positions.length < strikes) {
    const r = Math.floor(secureRng() * GRID_SIZE);
    const c = Math.floor(secureRng() * GRID_SIZE);
    const key = `${r}-${c}`;
    if (
      !positions.find((p) => p.key === key) &&
      newGrid[r][c]?.symbol?.id !== "scatter"
    ) {
      positions.push({ r, c, key });
      newGrid[r][c] = { ...newGrid[r][c], symbol: WILD, state: "wild" };
    }
  }
  return { grid: newGrid, strikePositions: positions };
}

// ── delay helper ──────────────────────────────────────────────────
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════════
// Main hook
// ══════════════════════════════════════════════════════════════════
export function useMaximus() {
  const { user } = useAuth();
  const { balance, placeBet, addWinnings } = useWallet();

  const [grid, setGrid] = useState(generateGrid);
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [multiplier, setMultiplier] = useState(1);
  const [totalPayout, setTotalPayout] = useState(0);
  const [matchedCells, setMatchedCells] = useState([]);
  const [bonusActive, setBonusActive] = useState(false);
  const [lightningPos, setLightningPos] = useState([]);
  const [cascadeCount, setCascadeCount] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("game_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("game", "maximus")
      .order("created_at", { ascending: false })
      .limit(8);
    if (data) setHistory(data);
  }, [user]);

  // ── Cascade chain processor ────────────────────────────────────
  const processCascade = useCallback(
    async (currentGrid, currentMult, accumulated, cascadeNum) => {
      const clusters = findClusters(currentGrid);
      if (clusters.length === 0) {
        setPhase("complete");
        setMatchedCells([]);
        return accumulated;
      }

      const allMatched = clusters.flatMap((c) => c.cells);
      setMatchedCells(allMatched);
      setPhase("cascading");
      audio.playCascade(cascadeNum);

      // Highlight matched
      setGrid(
        currentGrid.map((row) =>
          row.map((cell) => {
            const isMatch = allMatched.find(
              (m) => m.row === cell.row && m.col === cell.col,
            );
            return isMatch ? { ...cell, state: "matched" } : cell;
          }),
        ),
      );

      const roundPayout = calcClusterPayout(clusters, betAmount, currentMult);
      await delay(700);

      const newGrid = applyGravity(currentGrid, allMatched);
      setGrid(newGrid);
      setMultiplier(currentMult);
      setCascadeCount(cascadeNum);
      audio.playTileDrop();
      await delay(600);

      // Cap cascade multiplier at MAX_MULTI
      const nextMult = Math.min(
        currentMult + (cascadeNum > 0 ? 1 : 0),
        MAX_MULTI,
      );
      return processCascade(
        newGrid,
        nextMult,
        accumulated + roundPayout,
        cascadeNum + 1,
      );
    },
    [betAmount],
  );

  const spin = useCallback(async () => {
    if (spinning || betAmount <= 0 || betAmount > balance) return;
    const ok = await placeBet(betAmount);
    if (!ok) return;

    audio.playSpin();
    setSpinning(true);
    setPhase("spinning");
    setMultiplier(1);
    setTotalPayout(0);
    setMatchedCells([]);
    setCascadeCount(0);
    setBonusActive(false);
    setLightningPos([]);
    setLastResult(null);

    let newGrid = generateGrid();
    setGrid(newGrid);
    await delay(600);

    const scatters = countScatters(newGrid);
    let bonusGrid = newGrid;
    let bonusTriggered = false;

    if (scatters >= SCATTER_THRESH) {
      bonusTriggered = true;
      setBonusActive(true);
      audio.playZeusBonus();
      setPhase("bonus");
      await delay(800);
      const { grid: bg, strikePositions } = applyZeusBonus(newGrid);
      bonusGrid = bg;
      setGrid(bg);
      setLightningPos(strikePositions);
      await delay(1000);
      setLightningPos([]);
    }

    let totalWon = await processCascade(bonusGrid, 1, 0, 0);

    // ── CAP payout ────────────────────────────────────────────
    const maxPayout = betAmount * MAX_PAYOUT_MULT;
    if (totalWon > maxPayout) {
      console.log(`[Maximus] Payout capped: ${totalWon} → ${maxPayout}`);
      totalWon = maxPayout;
    }

    if (totalWon > 0) {
      await addWinnings(totalWon, `Maximus win`);
      if (totalWon >= betAmount * 25) audio.playJackpot();
      else if (totalWon >= betAmount * 5) audio.playBigWin();
      else audio.playSmallWin();
    }

    setTotalPayout(totalWon);
    const result =
      totalWon >= betAmount * 25 ? "jackpot" : totalWon > 0 ? "win" : "lose";
    setLastResult({
      result,
      payout: totalWon,
      multiplier: Math.min(cascadeCount + 1, MAX_MULTI),
    });

    if (user) {
      await supabase.from("game_history").insert({
        user_id: user.id,
        game: "maximus",
        bet_amount: betAmount,
        result,
        symbols: [bonusTriggered ? "bonus" : "normal"],
        payout: totalWon,
      });
      loadHistory();
    }

    setSpinning(false);
    setPhase("idle");
  }, [
    spinning,
    betAmount,
    balance,
    placeBet,
    addWinnings,
    user,
    loadHistory,
    processCascade,
  ]);

  return {
    grid,
    betAmount,
    setBetAmount,
    spinning,
    phase,
    multiplier,
    totalPayout,
    matchedCells,
    bonusActive,
    lightningPositions: lightningPos,
    cascadeCount,
    lastResult,
    history,
    spin,
    loadHistory,
    SYMBOLS,
  };
}
export { SYMBOLS as MAXIMUS_SYMBOLS };
