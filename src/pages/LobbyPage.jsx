import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import "../styles/lobby.css";

const GAMES = [
  {
    id: "leprechaun",
    path: "/game/leprechaun",
    title: "Lucky Leprechaun",
    desc: "Follow the rainbow to a pot of gold! Match magical Irish symbols.",
    symbols: ["🍀", "🪙", "🌈", "🎩"],
    bannerClass: "game-card__banner--leprechaun",
    badge: "HOT",
    type: "3-Reel Slots",
  },
  {
    id: "wildwest",
    path: "/game/wildwest",
    title: "Wild West",
    desc: "High noon in the saloon. Draw your hand and ride into a sunset of gold.",
    symbols: ["🤠", "🐎", "🔫", "🥃"],
    bannerClass: "game-card__banner--wildwest",
    badge: null,
    type: "3-Reel Slots",
  },
  {
    id: "maximus",
    path: "/game/maximus",
    title: "MAXIMUS",
    desc: "Zeus unleashes a 5×5 storm. Chain cascades, multiply your power, claim Olympus.",
    symbols: ["⚡", "🌩️", "🔱", "🌟"],
    bannerClass: "game-card__banner--maximus",
    badge: "NEW",
    type: "5×5 Cluster",
  },
  {
    id: "tsunami",
    path: "/game/tsunami",
    title: "TSUNAMI",
    desc: "Ride the tidal shifts. Fill the water meter to unleash Poseidon's devastating tsunami.",
    symbols: ["🌊", "🐠", "🦑", "🔱"],
    bannerClass: "game-card__banner--tsunami",
    badge: "NEW",
    type: "5×5 Tidal Shift",
  },
];

export default function LobbyPage() {
  const { user } = useAuth();
  const { balance } = useWallet();
  const username = user?.email?.split("@")[0] ?? "Player";

  return (
    <div className="page">
      <div className="lobby-header animate-fade-in">
        <h1>Welcome back, {username}!</h1>
        <p>Choose a game and let the chips fall where they may.</p>
      </div>

      {/* Quick stats */}
      <div className="lobby-stats">
        <div className="stat-card">
          <div className="stat-card__value">🪙 {balance.toLocaleString()}</div>
          <div className="stat-card__label">Your Chips</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">4</div>
          <div className="stat-card__label">Games Available</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">🎰</div>
          <div className="stat-card__label">Slots & More</div>
        </div>
      </div>

      {/* Game Cards */}
      <div className="games-grid">
        {GAMES.map((game) => (
          <Link to={game.path} key={game.id} className="game-card">
            {game.badge && <div className="game-card__hot">{game.badge}</div>}
            <div className={`game-card__banner ${game.bannerClass}`}>
              <div className="game-card__symbols">
                {game.symbols.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
            </div>
            <div className="game-card__body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "0.4rem",
                }}
              >
                <h3 className="game-card__title" style={{ margin: 0 }}>
                  {game.title}
                </h3>
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 4,
                    padding: "0.15rem 0.5rem",
                    whiteSpace: "nowrap",
                    marginLeft: "0.5rem",
                  }}
                >
                  {game.type}
                </span>
              </div>
              <p className="game-card__desc">{game.desc}</p>
              <span className="game-card__play">Play Now →</span>
            </div>
          </Link>
        ))}
      </div>

      {balance < 50 && (
        <div className="alert alert--info" style={{ textAlign: "center" }}>
          Running low on chips?{" "}
          <Link to="/wallet" style={{ color: "var(--gold)", fontWeight: 700 }}>
            Buy more chips →
          </Link>
        </div>
      )}
    </div>
  );
}
