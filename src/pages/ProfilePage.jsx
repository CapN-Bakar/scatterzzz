// src/pages/ProfilePage.jsx
// ─────────────────────────────────────────────
// User profile: stats, game history, account info.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import { supabase } from '../lib/supabase'

const GAME_LABELS = {
  lucky_leprechaun: '🍀 Lucky Leprechaun',
  wild_west: '🤠 Wild West',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { balance } = useWallet()
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState({ totalSpins: 0, totalWon: 0, totalBet: 0, biggestWin: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  const username = user?.email?.split('@')[0] ?? 'Player'

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return
      const { data } = await supabase
        .from('game_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setHistory(data)
        const totalSpins = data.length
        const totalWon   = data.reduce((s, r) => s + (r.payout || 0), 0)
        const totalBet   = data.reduce((s, r) => s + (r.bet_amount || 0), 0)
        const biggestWin = data.reduce((m, r) => Math.max(m, r.payout || 0), 0)
        setStats({ totalSpins, totalWon, totalBet, biggestWin })
      }
      setLoading(false)
    }
    fetchHistory()
  }, [user])

  const filteredHistory = activeTab === 'all'
    ? history
    : history.filter(h => h.game === activeTab)

  const netProfit = stats.totalWon - stats.totalBet
  const winRate = stats.totalSpins > 0
    ? ((history.filter(h => h.result !== 'lose').length / stats.totalSpins) * 100).toFixed(1)
    : 0

  return (
    <div className="page">
      {/* Profile Header */}
      <div className="card card--glow" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', flexShrink: 0,
        }}>
          🎰
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ color: 'var(--gold)', marginBottom: '0.25rem' }}>{username}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.email}</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            Member since {user?.created_at ? formatDate(user.created_at) : '—'}
          </p>
        </div>

        <button className="btn btn--outline btn--sm" onClick={signOut}>
          Sign Out
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {[
          { label: 'Balance',     value: `🪙 ${balance.toLocaleString()}`,         color: 'var(--gold)' },
          { label: 'Total Spins', value: stats.totalSpins,                          color: 'var(--neon-blue)' },
          { label: 'Win Rate',    value: `${winRate}%`,                             color: 'var(--neon-green)' },
          { label: 'Biggest Win', value: `+${stats.biggestWin.toLocaleString()}`,   color: 'var(--gold-light)' },
          { label: 'Net Profit',  value: `${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}`,
            color: netProfit >= 0 ? 'var(--neon-green)' : '#ff6b8a' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1.25rem 0.75rem' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.3rem' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Game History */}
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Game History
      </h2>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All Games' },
          { key: 'lucky_leprechaun', label: '🍀 Leprechaun' },
          { key: 'wild_west', label: '🤠 Wild West' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`btn btn--sm ${activeTab === tab.key ? 'btn--gold' : 'btn--outline'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="spinner" />
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          No spins yet — go play!
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto auto',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.7rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)',
          }}>
            <span>Game</span>
            <span>Symbols</span>
            <span>Bet</span>
            <span>Payout</span>
            <span>Result</span>
          </div>

          {filteredHistory.map(item => (
            <div key={item.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto auto',
              gap: '0.75rem',
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              fontSize: '0.82rem',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{GAME_LABELS[item.game] ?? item.game}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{formatDate(item.created_at)}</div>
              </div>
              <span style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>
                {Array.isArray(item.symbols) ? item.symbols.join(' ') : '—'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{item.bet_amount}</span>
              <span style={{ fontWeight: 700, color: item.payout > 0 ? 'var(--neon-green)' : 'var(--text-dim)' }}>
                {item.payout > 0 ? `+${item.payout}` : '—'}
              </span>
              <span className={`badge badge--${item.result}`}>{item.result}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
