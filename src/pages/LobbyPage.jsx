// src/pages/LobbyPage.jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import '../styles/lobby.css'

export default function LobbyPage() {
  const { user } = useAuth()
  const { balance } = useWallet()

  const username = user?.email?.split('@')[0] ?? 'Player'

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
          <div className="stat-card__value">2</div>
          <div className="stat-card__label">Games Available</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">🎰</div>
          <div className="stat-card__label">Slots</div>
        </div>
      </div>

      {/* Game Cards */}
      <div className="games-grid">
        {/* Lucky Leprechaun */}
        <Link to="/game/leprechaun" className="game-card">
          <div className="game-card__hot">HOT</div>
          <div className="game-card__banner game-card__banner--leprechaun">
            <div className="game-card__symbols">
              <span>🍀</span>
              <span>🪙</span>
              <span>🌈</span>
              <span>🎩</span>
            </div>
          </div>
          <div className="game-card__body">
            <h3 className="game-card__title">Lucky Leprechaun</h3>
            <p className="game-card__desc">
              Follow the rainbow to a pot of gold! Match magical symbols for massive wins.
            </p>
            <span className="game-card__play">Play Now →</span>
          </div>
        </Link>

        {/* Wild West */}
        <Link to="/game/wildwest" className="game-card">
          <div className="game-card__banner game-card__banner--wildwest">
            <div className="game-card__symbols">
              <span>🤠</span>
              <span>🐎</span>
              <span>🔫</span>
              <span>🥃</span>
            </div>
          </div>
          <div className="game-card__body">
            <h3 className="game-card__title">Wild West</h3>
            <p className="game-card__desc">
              High noon in the saloon. Draw your hand and ride into a sunset of gold.
            </p>
            <span className="game-card__play">Play Now →</span>
          </div>
        </Link>
      </div>

      {/* Low balance nudge */}
      {balance < 50 && (
        <div className="alert alert--info" style={{ textAlign: 'center' }}>
          Running low on chips?{' '}
          <Link to="/wallet" style={{ color: 'var(--gold)', fontWeight: 700 }}>
            Buy more chips →
          </Link>
        </div>
      )}
    </div>
  )
}
