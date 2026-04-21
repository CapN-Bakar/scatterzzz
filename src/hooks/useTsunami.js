// src/hooks/useTsunami.js  — REBALANCED v2
// ═══════════════════════════════════════════════════════════════════
// Key changes from v1:
//   1. Symbol values reduced ~60%
//   2. Scatter weight: 1 → 0.3
//   3. Water meter fill rate: 8-25% → 2-6% per match
//     (bonus every ~15-25 spins instead of every ~4)
//   4. Poseidon bonus board: mixed symbols (NOT all high-value)
//   5. Payout capped at 50× bet per spin
//   6. New tile pool biased toward common symbols
//   7. Column matches REMOVED (too many chains) — horizontal only
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { audio } from "../lib/audioSystem";

// ── BALANCED symbols ─────────────────────────────────────────────
const SYMBOLS = [
  { id: "wave", emoji: "🌊", label: "Wave", weight: 8, value: 0.4 },
  { id: "fish", emoji: "🐠", label: "Fish", weight: 7, value: 0.6 },
  { id: "shell", emoji: "🐚", label: "Shell", weight: 5, value: 0.9 },
  { id: "coral", emoji: "🪸", label: "Coral", weight: 3, value: 1.5 },
  { id: "kraken", emoji: "🦑", label: "Kraken", weight: 1.5, value: 2.5 },
  { id: "pearl", emoji: "🫧", label: "Pearl", weight: 0.5, value: 4.0 },
  { id: "scatter", emoji: "🌀", label: "Scatter", weight: 0.3, value: 0 },
];

const SYM_MAP = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
const ROWS = 5;
const COLS = 5;
const MAX_PAYOUT_MULT = 50;
const WATER_FILL_MIN = 2; // % per match (was 8)
const WATER_FILL_MAX = 6; // % per match (was 25)

// Bonus board symbol mix (NOT all high value)
const BONUS_HIGH = SYMBOLS.filter((s) => s.value >= 2.5 && s.weight > 0);
const BONUS_MID = SYMBOLS.filter(
  (s) => s.value >= 0.9 && s.value < 2.5 && s.weight > 0,
);
const BONUS_LOW = SYMBOLS.filter(
  (s) => s.value > 0 && s.value < 0.9 && s.weight > 0,
);

function rng() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / (0xffffffff + 1);
}

function pick(pool) {
  const total = pool.reduce((s, sym) => s + sym.weight, 0);
  let r = rng() * total;
  for (const sym of pool) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return pool[pool.length - 1];
}

// ── Grid generation ───────────────────────────────────────────────
export function generateGrid() {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      key: `${r}-${c}-${Date.now()}-${rng()}`,
      symbol: pick(SYMBOLS),
      row: r,
      col: c,
      state: "idle",
    })),
  );
}

// ── Row match detection (horizontal only) ─────────────────────────
// CHANGE from v1: removed column detection (was too many free chains)
export function findRowMatches(grid) {
  const matches = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const cell = grid[r][c];
      if (!cell?.symbol) {
        c++;
        continue;
      }
      const symId = cell.symbol.id;
      if (symId === "scatter") {
        c++;
        continue;
      }
      let run = 1;
      while (
        c + run < COLS &&
        grid[r][c + run]?.symbol &&
        (grid[r][c + run].symbol.id === symId ||
          grid[r][c + run].symbol.id === "wild")
      )
        run++;
      if (run >= 3) {
        matches.push({
          row: r,
          cols: Array.from({ length: run }, (_, i) => c + i),
          symbolId:
            symId === "wild" ? (grid[r][c + 1]?.symbol?.id ?? symId) : symId,
          length: run,
        });
        c += run;
      } else c++;
    }
  }
  return matches;
}

// ── Match payout ──────────────────────────────────────────────────
function calcMatchPayout(matches, bet) {
  return Math.floor(
    matches.reduce((sum, m) => {
      const sym = SYM_MAP[m.symbolId];
      if (!sym) return sum;
      const lenBonus = m.length === 5 ? 3 : m.length === 4 ? 2 : 1; // was 4,2.5,1
      return sum + bet * sym.value * lenBonus;
    }, 0),
  );
}

// ── Tidal shift: shift matching rows left ─────────────────────────
function applyTidalShift(grid, matchedRows) {
  const newGrid = grid.map((row) => row.map((c) => ({ ...c, state: "idle" })));
  for (const r of matchedRows) {
    for (let c = 0; c < COLS - 1; c++) {
      newGrid[r][c] = { ...newGrid[r][c + 1], col: c, state: "shifting" };
    }
    // New tile from common pool (biased low for balance)
    newGrid[r][COLS - 1] = {
      key: `shift-${r}-${Date.now()}`,
      symbol: pick(SYMBOLS.filter((s) => s.weight > 2)), // biased toward common
      row: r,
      col: COLS - 1,
      state: "new",
    };
  }
  return newGrid;
}

// ── Poseidon bonus: MIXED board (not all high-value) ──────────────
function applyTsunamiBonus(grid) {
  return grid.map((row) =>
    row.map((cell) => {
      const roll = rng();
      let sym;
      if (roll < 0.35) sym = BONUS_HIGH[Math.floor(rng() * BONUS_HIGH.length)];
      else if (roll < 0.8)
        sym = BONUS_MID[Math.floor(rng() * BONUS_MID.length)];
      else sym = BONUS_LOW[Math.floor(rng() * BONUS_LOW.length)];
      return {
        ...cell,
        symbol: sym,
        state: "poseidon",
        key: `tsunami-${cell.row}-${cell.col}-${Date.now()}`,
      };
    }),
  );
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════════
// Main hook
// ══════════════════════════════════════════════════════════════════
export function useTsunami() {
  const { user } = useAuth();
  const { balance, placeBet, addWinnings } = useWallet();

  const [grid, setGrid] = useState(generateGrid);
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [waterLevel, setWaterLevel] = useState(0);
  const [totalPayout, setTotalPayout] = useState(0);
  const [shiftRows, setShiftRows] = useState([]);
  const [bonusActive, setBonusActive] = useState(false);
  const [waveCount, setWaveCount] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("game_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("game", "tsunami")
      .order("created_at", { ascending: false })
      .limit(8);
    if (data) setHistory(data);
  }, [user]);

  const processWaveChain = useCallback(
    async (currentGrid, accumulated, wave, currentWater) => {
      const rowMatches = findRowMatches(currentGrid);
      if (rowMatches.length === 0)
        return { total: accumulated, water: currentWater };

      setPhase("matching");
      setWaveCount(wave);
      audio.playMatch();

      // Highlight
      const matchedSet = new Set();
      rowMatches.forEach((m) =>
        m.cols.forEach((c) => matchedSet.add(`${m.row}-${c}`)),
      );
      setGrid(
        currentGrid.map((row) =>
          row.map((cell) =>
            matchedSet.has(`${cell.row}-${cell.col}`)
              ? { ...cell, state: "matched" }
              : cell,
          ),
        ),
      );

      const roundPayout = calcMatchPayout(rowMatches, betAmount);

      // Water meter fill: 2–6% per match (was 8–25%)
      const waterGain =
        WATER_FILL_MIN +
        Math.floor(rng() * (WATER_FILL_MAX - WATER_FILL_MIN + 1));
      const newWater = Math.min(100, currentWater + waterGain);

      await delay(600);

      const matchedRows = [...new Set(rowMatches.map((m) => m.row))];
      setShiftRows(matchedRows);
      audio.playWaveCrash();

      const shiftedGrid = applyTidalShift(currentGrid, matchedRows);
      setGrid(shiftedGrid);
      setPhase("shifting");
      setWaterLevel(newWater);
      audio.playWaterRise();

      await delay(700);
      setShiftRows([]);

      return processWaveChain(
        shiftedGrid,
        accumulated + roundPayout,
        wave + 1,
        newWater,
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
    setTotalPayout(0);
    setShiftRows([]);
    setBonusActive(false);
    setWaveCount(0);
    setLastResult(null);

    let newGrid = generateGrid();
    setGrid(newGrid);
    await delay(700);

    // Read current water level
    let currentWater = 0;
    setWaterLevel((prev) => {
      currentWater = prev;
      return prev;
    });
    await delay(10);

    let isTsunami = false;
    let bonusGrid = newGrid;

    if (currentWater >= 100) {
      isTsunami = true;
      setBonusActive(true);
      setPhase("bonus");
      audio.playTsunamiBonus();
      await delay(1000);
      bonusGrid = applyTsunamiBonus(newGrid);
      setGrid(bonusGrid);
      await delay(1200);
      setWaterLevel(0);
    }

    const { total: totalWon, water: finalWater } = await processWaveChain(
      bonusGrid,
      0,
      0,
      isTsunami ? 0 : currentWater,
    );

    // Update water level with any gains from this spin's chains
    if (!isTsunami) setWaterLevel(finalWater);

    // ── CAP payout ─────────────────────────────────────────────
    const maxPayout = betAmount * MAX_PAYOUT_MULT;
    const cappedWon = Math.min(totalWon, maxPayout);

    if (cappedWon > 0) {
      await addWinnings(cappedWon, `Tsunami win`);
      if (cappedWon >= betAmount * 20) audio.playJackpot();
      else if (cappedWon >= betAmount * 5) audio.playBigWin();
      else audio.playSmallWin();
    }

    setTotalPayout(cappedWon);
    const result =
      cappedWon >= betAmount * 20 ? "jackpot" : cappedWon > 0 ? "win" : "lose";
    setLastResult({ result, payout: cappedWon, tsunami: isTsunami });

    if (user) {
      await supabase.from("game_history").insert({
        user_id: user.id,
        game: "tsunami",
        bet_amount: betAmount,
        result,
        symbols: [isTsunami ? "tsunami-bonus" : "normal"],
        payout: cappedWon,
      });
      loadHistory();
    }

    setPhase("complete");
    setSpinning(false);
    setTimeout(() => setPhase("idle"), 1000);
  }, [
    spinning,
    betAmount,
    balance,
    placeBet,
    addWinnings,
    user,
    loadHistory,
    processWaveChain,
  ]);

  return {
    grid,
    betAmount,
    setBetAmount,
    spinning,
    phase,
    waterLevel,
    totalPayout,
    shiftRows,
    bonusActive,
    waveCount,
    lastResult,
    history,
    spin,
    loadHistory,
    SYMBOLS,
  };
}
export { SYMBOLS as TSUNAMI_SYMBOLS };
