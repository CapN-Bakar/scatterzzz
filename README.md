# 🎰 ScatterZZZ — Virtual Casino Platform

A full-stack casino-style gaming platform with virtual chips, built with React (Vite) + Supabase.

---

## Tech Stack
- **Frontend:** React 18 + Vite
- **Styling:** Pure CSS (no frameworks)
- **Backend/Auth/DB:** Supabase
- **Routing:** React Router v6

---

## Project Structure

```
scatterzzz/
├── index.html
├── vite.config.js
├── package.json
├── .env.example                    ← copy to .env.local
├── supabase_schema.sql             ← run in Supabase SQL Editor
│
└── src/
    ├── main.jsx                    ← app entry point
    ├── App.jsx                     ← routing
    │
    ├── lib/
    │   └── supabase.js             ← Supabase client
    │
    ├── context/
    │   ├── AuthContext.jsx         ← auth state & actions
    │   └── WalletContext.jsx       ← chip balance & transactions
    │
    ├── hooks/
    │   └── useSlotMachine.js       ← shared game logic (RNG, bet/win)
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.jsx
    │   │   └── Navbar.css
    │   └── games/
    │       └── SlotMachine.jsx     ← reusable slot UI + Paytable + History
    │
    ├── pages/
    │   ├── LoginPage.jsx
    │   ├── SignupPage.jsx
    │   ├── LobbyPage.jsx           ← game selection
    │   ├── LeprechaunPage.jsx      ← 🍀 Lucky Leprechaun game
    │   ├── WildWestPage.jsx        ← 🤠 Wild West game
    │   ├── WalletPage.jsx          ← buy chips + transaction history
    │   └── ProfilePage.jsx         ← stats + full game history
    │
    └── styles/
        ├── global.css              ← design tokens, animations, utilities
        ├── auth.css
        ├── lobby.css
        ├── slot.css                ← shared slot machine styles
        └── wallet.css
```

---

## Setup Guide

### Step 1 — Create a Supabase Project
1. Go to https://supabase.com and create a new project.
2. Note your **Project URL** and **anon/public API key** from:
   `Dashboard → Settings → API`

### Step 2 — Run the SQL Schema
1. In your Supabase dashboard go to **SQL Editor**
2. Paste the entire contents of `supabase_schema.sql` and click **Run**
3. This creates: `users`, `wallets`, `transactions`, `game_history` tables,
   RLS policies, and auto-setup triggers.

### Step 3 — Configure Auth
1. Go to **Authentication → Settings**
2. Under **Email Auth**, confirm "Enable Email Signup" is ON
3. For development, you can disable "Confirm email" (Email Confirmations → off)
   so users can log in immediately without checking email.

### Step 4 — Set up Environment Variables
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_CHIPS_PER_PHP=10
```

### Step 5 — Install & Run
```bash
npm install
npm run dev
```
Open http://localhost:5173

---

## Database Schema Overview

### Tables
| Table | Purpose |
|-------|---------|
| `users` | Extended user profile (extends `auth.users`) |
| `wallets` | One row per user, stores chip balance |
| `transactions` | Full audit log: deposits, bets, wins, bonuses |
| `game_history` | Every spin result with symbols and payout |

### Transaction Types
- `deposit` — chips purchased via GCash
- `bet` — chips deducted when spinning
- `win` — chips awarded on a win
- `bonus` — welcome chips on signup

### RLS Security
All tables have Row Level Security enabled. Users can only read/write their own data. The `deduct_chips` and `add_chips` functions run as `SECURITY DEFINER` for safe atomic operations.

---

## Game Logic

### RNG
Uses `crypto.getRandomValues()` — cryptographically stronger than `Math.random()`.

### Symbol Weights
Each symbol has a `weight` property. Higher weight = more frequent.
Example: `{ id: '💎', weight: 1 }` (rare) vs `{ id: '🍀', weight: 4 }` (common)

### Win Evaluation (3 reels)
1. **Triple** — all 3 reels match → check paytable for multiplier (up to 25x)
2. **Pair** — any 2 match → check paytable (1.5x–3x)
3. **No match** — lose bet

### Adding a New Game
1. Create a new page `src/pages/YourGamePage.jsx`
2. Define `SYMBOLS` array and `PAYTABLE` array
3. Define a `THEME` object with `cssVars`
4. Use `<SlotMachine symbols={...} paytable={...} gameName="your_game" theme={...} />`
5. Add a route in `App.jsx` and a card in `LobbyPage.jsx`
6. Add `your_game` to the `CHECK` constraint in `game_history` table

---

## Chip Conversion
Configurable via `VITE_CHIPS_PER_PHP` env var.
Default: `1 PHP = 10 chips`

---

## Responsible Gaming Features
- Virtual chips only — no real monetary value
- Balance displayed prominently at all times
- Low balance nudge in lobby
- "Play Responsibly" notice in wallet
- No hidden mechanics, no push notifications, no urgency manipulation
- Win history always visible so players know their actual record

---

## Build for Production
```bash
npm run build
npm run preview
```
Deploy the `dist/` folder to Vercel, Netlify, or any static host.
Remember to add your environment variables in the hosting dashboard.

---

## Suggestions for Improvement

### Near-term
- [ ] Email verification flow
- [ ] Username/avatar customization in profile
- [ ] Sound effects (Web Audio API, no library needed)
- [ ] Leaderboard (top balances, most wins)
- [ ] Daily login bonus

### Game Mechanics
- [ ] Scatter symbols (win regardless of position)
- [ ] Wild symbols (substitute for any symbol)
- [ ] Free spins feature
- [ ] Bet multiplier (1x, 2x, 5x)
- [ ] Progressive jackpot counter

### Technical
- [ ] Supabase Realtime for live jackpot display
- [ ] Optimistic UI updates (skip waiting for DB on every spin)
- [ ] PWA manifest for mobile install
- [ ] Cypress/Playwright E2E tests for game flows
- [ ] Admin dashboard to view all game_history
