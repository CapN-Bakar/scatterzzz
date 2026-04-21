// src/pages/TsunamiPage.jsx
// ─────────────────────────────────────────────────────────────────
// TSUNAMI — Poseidon / Ocean
// 5x5 grid, tidal shift rows, water meter, Poseidon bonus
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTsunami, TSUNAMI_SYMBOLS } from "../hooks/useTsunami";
import { audio } from "../lib/audioSystem";
import AudioControls from "../components/AudioControls";
import "../styles/tsunami.css";
import "../styles/game_size_fixes.css";

const BET_PRESETS = [5, 10, 25, 50, 100];
const MAX_WAVE_DOTS = 6;
const PAYTABLE_ROWS = TSUNAMI_SYMBOLS.filter((s) => s.value > 0).sort(
  (a, b) => b.value - a.value,
);

const PHASE_LABELS = {
  spinning: "Waves Gathering...",
  matching: "Match Found!",
  shifting: "Tidal Shift!",
  bonus: "Poseidon Rises!",
  complete: "",
  idle: "",
};

export default function TsunamiPage() {
  const {
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
  } = useTsunami();

  const cabinetRef = useRef(null);

  useEffect(() => {
    loadHistory();
    audio.playBGMTsunami();
    return () => audio.stopBGM();
  }, [loadHistory]);

  // Wave particles on win
  useEffect(() => {
    if (!lastResult || lastResult.result === "lose" || !cabinetRef.current)
      return;
    for (let i = 0; i < 8; i++) {
      const el = document.createElement("div");
      el.className = "wave-particle";
      el.textContent = "🌊";
      el.style.cssText = `
        left:${10 + Math.random() * 80}%;
        top:${20 + Math.random() * 60}%;
        --drift:${(Math.random() - 0.5) * 60}px;
        animation-delay:${Math.random() * 0.4}s;
      `;
      cabinetRef.current.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    }
  }, [lastResult]);

  const canSpin = !spinning && betAmount > 0;
  const isTsunamiReady = waterLevel >= 100;

  // Build set of rows currently shifting
  const shiftRowSet = new Set(shiftRows);

  return (
    <div className="tsunami-page">
      <div className="tsunami-page__inner">
        {/* Back */}
        <Link
          to="/"
          className="back-link"
          style={{ color: "rgba(0,229,204,0.4)" }}
        >
          ← Lobby
        </Link>

        {/* Header */}
        <div className="tsunami-header">
          <h1 className="tsunami-title">🌊 TSUNAMI</h1>
          <p className="tsunami-subtitle">The Fury of Poseidon</p>
        </div>

        {/* Water meter */}
        {isTsunamiReady && (
          <div className="tsunami-ready">
            🌊 TSUNAMI READY — Next spin triggers Poseidon!
          </div>
        )}
        <div className="water-meter" title={`Water: ${waterLevel}%`}>
          <span className="water-meter__icon">🌊</span>
          <div
            className="water-meter__fill"
            style={{ width: `${waterLevel}%` }}
          />
          <span className="water-meter__label">
            {waterLevel >= 100 ? "TSUNAMI!" : `${Math.round(waterLevel)}%`}
          </span>
        </div>

        {/* Cabinet */}
        <div className="tsunami-cabinet" ref={cabinetRef}>
          {/* Poseidon bonus overlay */}
          {bonusActive && phase === "bonus" && (
            <div className="tsunami-bonus-overlay">
              <div className="tsunami-bonus-waves">
                <div className="wave-layer" />
                <div className="wave-layer" />
                <div className="wave-layer" />
              </div>
              <div className="tsunami-bonus-title">
                🧜 POSEIDON
                <br />
                RISES! 🌊
              </div>
              <div className="tsunami-bonus-sub">The ocean transforms!</div>
            </div>
          )}

          {/* ── 5x5 Grid ── */}
          <div className="tsunami-grid">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isShifting = shiftRowSet.has(r);
                return (
                  <div
                    key={cell.key}
                    className="tsunami-tile"
                    data-state={
                      isShifting && spinning ? "shifting" : cell.state
                    }
                    style={{
                      animationDelay:
                        cell.state === "new"
                          ? `${c * 0.05}s`
                          : cell.state === "poseidon"
                            ? `${(r * 5 + c) * 0.04}s`
                            : "0s",
                      // Subtle blue tint for shifting rows
                      outline: isShifting
                        ? "1px solid rgba(0,229,204,0.35)"
                        : undefined,
                    }}
                    title={cell.symbol?.label}
                  >
                    {cell.symbol?.emoji}
                  </div>
                );
              }),
            )}
          </div>

          {/* ── Result banner ── */}
          {lastResult && !spinning && (
            <div className={`tsunami-result ${lastResult.result}`}>
              <div className="result-banner__label">
                {lastResult.tsunami && "🌊 "}
                {lastResult.result === "jackpot"
                  ? "POSEIDON'S TREASURE!"
                  : lastResult.result === "win"
                    ? `Wave Win${waveCount > 1 ? ` (${waveCount} waves)` : ""}`
                    : "The tide recedes..."}
                {lastResult.tsunami && " 🔱"}
              </div>
              {lastResult.result !== "lose" && (
                <div
                  className="result-banner__amount"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  +{lastResult.payout.toLocaleString()} chips
                </div>
              )}
            </div>
          )}

          {/* ── Controls ── */}
          <div className="tsunami-controls">
            {/* Stats */}
            <div className="tsunami-info-row">
              <div className="tsunami-stat">
                <div
                  className="tsunami-stat__value"
                  style={{ color: "var(--seafoam)" }}
                >
                  {totalPayout > 0 ? `+${totalPayout.toLocaleString()}` : "—"}
                </div>
                <div className="tsunami-stat__label">Win</div>
              </div>

              <div className="tsunami-stat">
                <div className="wave-count">
                  {Array.from({ length: MAX_WAVE_DOTS }).map((_, i) => (
                    <div
                      key={i}
                      className={`wave-dot ${i < waveCount ? "active" : ""}`}
                    />
                  ))}
                </div>
                <div
                  className="tsunami-stat__label"
                  style={{ marginTop: "0.4rem" }}
                >
                  Waves
                </div>
              </div>

              <div className="tsunami-stat">
                <div className="tsunami-stat__value">
                  {Math.round(waterLevel)}%
                </div>
                <div className="tsunami-stat__label">Tide Level</div>
              </div>
            </div>

            {/* Phase */}
            <div className={`tsunami-phase ${spinning ? "active" : ""}`}>
              {PHASE_LABELS[phase] || ""}
            </div>

            {/* Bet row */}
            <div className="tsunami-bet-row bet-row">
              <span className="bet-row__label">Bet</span>
              <span
                className="bet-row__amount"
                style={{ color: "var(--seafoam)" }}
              >
                🪙 {betAmount}
              </span>
              <div className="bet-presets">
                {BET_PRESETS.map((p) => (
                  <button
                    key={p}
                    className={`bet-preset-btn ${betAmount === p ? "active" : ""}`}
                    onClick={() => setBetAmount(p)}
                    disabled={spinning}
                  >
                    {p}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={betAmount}
                  onChange={(e) =>
                    setBetAmount(Math.max(1, Number(e.target.value)))
                  }
                  disabled={spinning}
                  style={{
                    width: 52,
                    background: "rgba(0,229,204,0.03)",
                    border: "1px solid rgba(0,229,204,0.08)",
                    borderRadius: 6,
                    color: "#fff",
                    padding: "0.25rem 0.35rem",
                    fontSize: "0.75rem",
                    textAlign: "center",
                  }}
                />
              </div>
            </div>

            {/* SPIN */}
            <button
              className="tsunami-spin-btn"
              onClick={spin}
              disabled={!canSpin}
            >
              {spinning ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.6rem",
                  }}
                >
                  <span
                    className="spinner"
                    style={{
                      width: 20,
                      height: 20,
                      borderTopColor: "var(--seafoam)",
                      border: "2px solid rgba(0,229,204,0.15)",
                    }}
                  />
                  {PHASE_LABELS[phase] || "Spinning..."}
                </span>
              ) : isTsunamiReady ? (
                "🌊 RELEASE THE TSUNAMI"
              ) : (
                "🔱 CAST THE NET"
              )}
            </button>
          </div>
        </div>

        {/* Mechanic explanation */}
        <div
          style={{
            marginTop: "1.25rem",
            background: "rgba(0,229,204,0.03)",
            border: "1px solid rgba(0,229,204,0.08)",
            borderRadius: 12,
            padding: "1rem",
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.35)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "rgba(0,229,204,0.6)" }}>
            🌊 Tidal Shift System:
          </strong>{" "}
          Match 3+ identical symbols in a row or column. Matching rows shift
          left — a fresh symbol washes in from the right. Chain reactions can
          trigger multiple waves per spin! Fill the tide meter to unleash
          Poseidon's{" "}
          <strong style={{ color: "rgba(0,229,204,0.5)" }}>
            Tsunami Bonus
          </strong>
          .
        </div>

        {/* Paytable */}
        <details style={{ marginTop: "1rem" }}>
          <summary
            style={{
              cursor: "pointer",
              color: "rgba(0,229,204,0.3)",
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              padding: "0.5rem 0",
              userSelect: "none",
            }}
          >
            Paytable ↓
          </summary>
          <div className="tsunami-paytable">
            <div className="tsunami-paytable__header">
              <span>Symbol</span>
              <span>Name</span>
              <span>Min</span>
              <span>Value</span>
            </div>
            {PAYTABLE_ROWS.map((sym) => (
              <div className="tsunami-paytable__row" key={sym.id}>
                <span className="tsunami-paytable__emoji">{sym.emoji}</span>
                <span className="tsunami-paytable__name">{sym.label}</span>
                <span className="tsunami-paytable__min">3 in row/col</span>
                <span className="tsunami-paytable__value">{sym.value}x</span>
              </div>
            ))}
            <div
              className="tsunami-paytable__row"
              style={{ background: "rgba(0,229,204,0.03)" }}
            >
              <span className="tsunami-paytable__emoji">🌀</span>
              <span className="tsunami-paytable__name">Whirlpool (3+)</span>
              <span className="tsunami-paytable__min">Anywhere</span>
              <span
                className="tsunami-paytable__value"
                style={{ color: "var(--poseidon)" }}
              >
                +15% tide
              </span>
            </div>
          </div>
        </details>

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <p
              style={{
                fontSize: "0.7rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "rgba(0,229,204,0.25)",
                marginBottom: "0.6rem",
              }}
            >
              Recent Spins
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.55rem 0.85rem",
                    background: "rgba(0,229,204,0.02)",
                    border: "1px solid rgba(0,229,204,0.05)",
                    borderRadius: 8,
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ flex: 1, color: "rgba(255,255,255,0.3)" }}>
                    Bet: {h.bet_amount}
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      color:
                        h.payout > 0
                          ? "var(--seafoam)"
                          : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {h.payout > 0 ? `+${h.payout}` : "—"}
                  </span>
                  <span className={`badge badge--${h.result}`}>{h.result}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AudioControls />
    </div>
  );
}
