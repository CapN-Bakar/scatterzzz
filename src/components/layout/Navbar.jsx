// src/components/layout/Navbar.jsx
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import './Navbar.css'

export default function Navbar() {
  const { signOut } = useAuth()
  const { balance } = useWallet()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo">
          Scatter<span>ZZZ</span>
        </Link>

        {/* Navigation links */}
        <ul className={`navbar__links ${menuOpen ? 'open' : ''}`}>
          <li><NavLink to="/" end onClick={closeMenu}>🎰 Lobby</NavLink></li>
          <li><NavLink to="/wallet" onClick={closeMenu}>💰 Wallet</NavLink></li>
          <li><NavLink to="/profile" onClick={closeMenu}>👤 Profile</NavLink></li>
          <li>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { signOut(); closeMenu() }}
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              Sign Out
            </button>
          </li>
        </ul>

        <div className="navbar__right">
          {/* Chip balance pill */}
          <div className="navbar__balance">
            <span className="navbar__balance-icon">🪙</span>
            {balance.toLocaleString()}
          </div>

          {/* Mobile hamburger */}
          <button
            className="navbar__hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </nav>
  )
}
