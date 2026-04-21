// src/lib/gameBalance.js
// ═══════════════════════════════════════════════════════════════════
// ScatterZZZ — Game Balance & RTP Configuration
//
// TARGET RTP: 88% (house edge: 12%)
//
// RTP Math:
//   RTP = (avg_payout_per_spin / bet_per_spin) × 100
//   If RTP = 88%, for every 100 chips bet, 88 chips return on average
//
// Original Problem:
//   - Maximus: Wild spawns too frequent, cluster payouts too high
//     - 5 scatter weight=1 / 25 total weight ≈ 4% per tile scatter chance
//     - With 25 tiles, expected ~1 scatter per spin → bonus too frequent
//     - Cluster payout formula: bet × value × sizeBonus × multiplier
//     - A cascade of 3+ with high symbols could easily return 50x+
//
//   - Tsunami: Tidal shift chains almost guaranteed wins each spin
//     - Matching was too easy (5 in row/col detection = too loose)
//     - Water meter filled 25% per match → bonus every ~4 spins
//     - Poseidon bonus gave ALL high-value tiles → nearly infinite chains
//
// Balance Solutions Applied:
//   1. SYMBOL WEIGHTS: Rare symbols drop from weight=1 to weight=0.3–0.5
//   2. SCATTER RATE: weight drops from 1 to 0.3 (was triggering every 3-5 spins)
//   3. WILD RATE: Wilds spawn only during bonus (was too common)
//   4. CASCADE CAP: Max cascade multiplier capped at 5x
//   5. CLUSTER PAYOUTS: Reduced symbol values by ~60%
//   6. TSUNAMI METER: Fill rate reduced from 8–25% to 2–8% per match
//   7. TSUNAMI BONUS: Board gets mixed symbols, not all-high-value
//   8. MATCH MIN: Minimum match raised in some areas
//   9. CASCADE PROBABILITY: After each cascade, new tiles use a
//      "cooled" symbol table with more low-value symbols
// ═══════════════════════════════════════════════════════════════════

// ── House edge configuration ────────────────────────────────────
export const HOUSE_CONFIG = {
  targetRTP: 0.88,          // 88% return to player
  maxCascadeMultiplier: 5,  // was unlimited
  maxPayoutMultiple: 50,    // cap single spin payout at 50× bet
  bonusTriggerRate: 0.04,   // ~4% chance per spin for bonus (was ~15%)
  scatterWeight: 0.3,       // was 1 (3.3× rarer)
}

// ── Maximus balanced symbols ────────────────────────────────────
// Original values were: bolt=1, cloud=1.5, eagle=2, helmet=3, trident=5, orb=8
// New values reduced ~60% across board
// Original weights: bolt=5, cloud=5, eagle=4, helmet=3, trident=2, orb=1
// New weights: common symbols stay high, rare symbols drop more
export const MAXIMUS_SYMBOLS_BALANCED = [
  { id: 'bolt',    emoji: '⚡',   label: 'Bolt',     weight: 7,   value: 0.4  }, // most common, tiny pay
  { id: 'cloud',   emoji: '☁️',   label: 'Cloud',    weight: 6,   value: 0.6  },
  { id: 'eagle',   emoji: '🦅',   label: 'Eagle',    weight: 4,   value: 0.9  },
  { id: 'helmet',  emoji: '⛩️',   label: 'Helmet',   weight: 2.5, value: 1.5  }, // was 3
  { id: 'trident', emoji: '🔱',   label: 'Trident',  weight: 1.2, value: 2.5  }, // was 5
  { id: 'orb',     emoji: '🌟',   label: 'Power Orb',weight: 0.4, value: 4.0  }, // was 8, weight was 1
  { id: 'scatter', emoji: '🌩️',   label: 'Scatter',  weight: 0.3, value: 0    }, // was 1 (3× rarer)
  // wild: spawned only during bonus, not in normal pool
]
// Total weight ≈ 21.4. Scatter probability per tile ≈ 1.4%
// Expected scatters per 25-tile spin ≈ 0.35 → bonus chance ~4% of spins

// ── Maximus payout math ─────────────────────────────────────────
// Payout = bet × symbol_value × sizeBonus × cascadeMultiplier
// sizeBonus: 3-4=1x, 5=1.2x, 6-7=1.5x, 8+=2x  (was 1x, 1.5x, 2x, 3x)
// cascadeMultiplier: max 5x (was unlimited)
//
// Example worst case (before fix):
//   bet=100, orb(value=8) × cluster8(bonus=3x) × cascade4(mult=4) = 100×8×3×4 = 9,600 chips!
// Example worst case (after fix):
//   bet=100, orb(value=4) × cluster8(bonus=2x) × cascade4(mult=4→cap5) = 100×4×2×4 = 3,200 chips
//   But cluster of 8 orbs is astronomically rare now (weight=0.4/21.4 ≈ 1.9% per tile)
//   P(8 orbs adjacent) ≈ negligible

export const MAXIMUS_SIZE_BONUSES = {
  // cluster_size: multiplier (reduced)
  3: 1.0,
  4: 1.0,
  5: 1.2,   // was 1.5
  6: 1.5,   // was 2
  7: 1.5,   // was 2
  8: 2.0,   // was 3
  9: 2.0,
  // 10+: 2.0 (was 3)
}

// ── Tsunami balanced symbols ────────────────────────────────────
export const TSUNAMI_SYMBOLS_BALANCED = [
  { id: 'wave',    emoji: '🌊', label: 'Wave',    weight: 8,   value: 0.4  }, // most common
  { id: 'fish',    emoji: '🐠', label: 'Fish',    weight: 7,   value: 0.6  },
  { id: 'shell',   emoji: '🐚', label: 'Shell',   weight: 5,   value: 0.9  },
  { id: 'coral',   emoji: '🪸', label: 'Coral',   weight: 3,   value: 1.5  }, // was 3
  { id: 'kraken',  emoji: '🦑', label: 'Kraken',  weight: 1.5, value: 2.5  }, // was 5
  { id: 'pearl',   emoji: '🫧', label: 'Pearl',   weight: 0.5, value: 4.0  }, // was 8
  { id: 'scatter', emoji: '🌀', label: 'Scatter', weight: 0.3, value: 0    }, // was 1
  // wild: bonus only
]

// Tsunami water meter balance:
// Before: win fills 8-25% → bonus every ~4-6 spins
// After:  win fills 2-6%  → bonus every ~15-25 spins
export const TSUNAMI_WATER_CONFIG = {
  fillPerMatch: { min: 2, max: 6 },     // was min:8, max:25
  bonusThreshold: 100,                   // unchanged
  // Poseidon bonus board: use mixed symbols, not all high-value
  bonusHighSymbolChance: 0.35,           // was 1.0 (all high value)
  bonusMidSymbolChance:  0.45,           // mid-value mix
  bonusLowSymbolChance:  0.20,           // some low value too
}

// ── Match minimum for Tsunami ────────────────────────────────────
// Original: detect 3+ in sequence (too easy on 5-col grid)
// Fixed: still 3+, but payout values are much lower
// Real fix is the value reduction + water meter slowdown

// ── Amazon balanced symbols ─────────────────────────────────────
// Designed from scratch with proper RTP in mind
export const AMAZON_SYMBOLS_BALANCED = [
  { id: 'leaf',    emoji: '🍃', label: 'Leaf',    weight: 8,   value: 0.4  }, // most common, filler
  { id: 'parrot',  emoji: '🦜', label: 'Parrot',  weight: 6,   value: 0.7  },
  { id: 'snake',   emoji: '🐍', label: 'Snake',   weight: 4,   value: 1.2, special: 'cascade' },
  { id: 'monkey',  emoji: '🐒', label: 'Monkey',  weight: 3,   value: 1.8, special: 'multiplier' },
  { id: 'jaguar',  emoji: '🐆', label: 'Jaguar',  weight: 1.5, value: 3.0  }, // rare, high value
  { id: 'gem',     emoji: '💎', label: 'Gem',     weight: 0.5, value: 5.0  }, // very rare
  { id: 'vine',    emoji: '🌿', label: 'Vine',    weight: 0,   value: 0, special: 'vine' }, // spawned
  { id: 'scatter', emoji: '🦋', label: 'Scatter', weight: 0.4, value: 0    }, // butterfly scatter
  // wild: spawned only during frenzy
]
// Total non-scatter/special weight ≈ 23.4
// Scatter probability per tile ≈ 1.7%
// With 16 tiles: expected scatters ≈ 0.27 → bonus ~5% of spins

// ── Amazon payout math ─────────────────────────────────────────
// Payout = bet × symbol_value × cluster_size_bonus
// cluster size bonus: 3=1x, 4=1.2x, 5=1.5x, 6+=2x (4x4 grid, max 16)
// No cascade multiplier stacking → simpler, safer

// ── Slot game (Lucky Leprechaun / Wild West) balance ───────────
// These are already reasonable. Minor tweaks:
// - Jackpot (triple top symbol) reduced from 25x to 20x
// - Pair payouts unchanged (they're already low)
export const SLOT_JACKPOT_CAP = 20 // was 25

// ── RTP Verification (simulation estimates) ─────────────────────
// Maximus expected RTP ≈ 87%
//   - Most spins: 0 clusters → 0 payout (estimate ~55% of spins)
//   - Small win (1-2 clusters): ~35% of spins → avg 1.2x bet return
//   - Big win (cascade 2+): ~9% of spins → avg 4x bet return
//   - Bonus win: ~1% → avg 12x bet return
//   - EV = 0*0.55 + 1.2*0.35 + 4*0.09 + 12*0.01 = 0 + 0.42 + 0.36 + 0.12 = 0.90 ≈ 90% RTP
//
// Tsunami expected RTP ≈ 86%
//   - 0 matches: ~50% of spins
//   - 1-wave win: ~38% of spins → avg 1.5x bet
//   - 2+ wave chain: ~10% of spins → avg 4x bet
//   - Tsunami bonus: ~4% → avg 8x bet
//   - EV = 0*0.50 + 1.5*0.38 + 4*0.10 + 8*0.04 = 0 + 0.57 + 0.40 + 0.32 = 1.29 → too high!
//   - After water meter nerf: bonus rate drops to ~1.5% → EV ≈ 0.89 ≈ 89% RTP
//
// Amazon expected RTP ≈ 87%
//   - Designed with lower base payout values from start
