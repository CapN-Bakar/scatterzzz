// src/pages/WalletPage.jsx
// ─────────────────────────────────────────────
// Chip balance, buy chips (simulated GCash), transaction history.
// ─────────────────────────────────────────────
import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import '../styles/wallet.css'

// PHP deposit presets
const PHP_PRESETS = [
  { php: 50,  label: '₱50'  },
  { php: 100, label: '₱100' },
  { php: 200, label: '₱200' },
  { php: 500, label: '₱500' },
  { php: 1000, label: '₱1k' },
  { php: 2000, label: '₱2k' },
]

// Transaction icon + label map
const TX_META = {
  deposit: { icon: '💚', label: 'GCash Deposit' },
  win:     { icon: '🏆', label: 'Win Payout' },
  bet:     { icon: '🎰', label: 'Bet Placed' },
  bonus:   { icon: '🎁', label: 'Bonus' },
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function WalletPage() {
  const { balance, transactions, walletLoading, depositChips, chipsPerPhp, fetchTransactions } = useWallet()

  const [selectedPhp, setSelectedPhp] = useState(100)
  const [customPhp, setCustomPhp] = useState('')
  const [gcashOpen, setGcashOpen] = useState(false)
  const [gcashStep, setGcashStep] = useState(1) // 1=review, 2=pin, 3=success
  const [pin, setPin] = useState('')
  const [depositResult, setDepositResult] = useState(null)

  const phpAmount = customPhp ? Number(customPhp) : selectedPhp
  const chipsPreview = Math.floor(phpAmount * chipsPerPhp)

  // ── Open GCash modal ─────────────────────────────────
  const openGcash = () => {
    if (phpAmount < 1) return
    setGcashStep(1)
    setPin('')
    setGcashOpen(true)
  }

  // ── Simulate PIN entry ───────────────────────────────
  const handlePinConfirm = async () => {
    if (pin.length < 4) return
    setGcashStep(3) // success
    const result = await depositChips(phpAmount)
    setDepositResult(result)
    await fetchTransactions()
  }

  const closeGcash = () => {
    setGcashOpen(false)
    setDepositResult(null)
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: '1.5rem' }}>💰 Wallet</h1>

      <div className="wallet-grid">
        {/* Balance Hero */}
        <div className="balance-hero">
          <p className="balance-hero__label">Your Chip Balance</p>
          <div className="balance-hero__amount">🪙 {balance.toLocaleString()}</div>
          <p className="balance-hero__php">
            ≈ ₱{(balance / chipsPerPhp).toFixed(2)} PHP equivalent
          </p>
        </div>

        {/* Buy Chips */}
        <div className="buy-card">
          <h3>Buy Chips</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            1 PHP = {chipsPerPhp} chips
          </p>

          <div className="php-presets">
            {PHP_PRESETS.map(({ php, label }) => (
              <button
                key={php}
                className={`php-preset ${selectedPhp === php && !customPhp ? 'selected' : ''}`}
                onClick={() => { setSelectedPhp(php); setCustomPhp('') }}
              >
                <div className="php-preset__php">{label}</div>
                <div className="php-preset__chips">{(php * chipsPerPhp).toLocaleString()} chips</div>
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label>Custom Amount (₱)</label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="e.g. 350"
              value={customPhp}
              onChange={e => { setCustomPhp(e.target.value); setSelectedPhp(0) }}
            />
          </div>

          {phpAmount > 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              You'll receive: <strong style={{ color: 'var(--gold)' }}>🪙 {chipsPreview.toLocaleString()} chips</strong>
            </p>
          )}

          <button
            className="btn btn--gold"
            style={{ width: '100%' }}
            onClick={openGcash}
            disabled={phpAmount < 1 || walletLoading}
          >
            Pay via GCash
          </button>
        </div>

        {/* Responsible gaming notice */}
        <div className="buy-card" style={{ background: 'rgba(0,207,255,0.04)', borderColor: 'rgba(0,207,255,0.15)' }}>
          <h3 style={{ color: 'var(--neon-blue)', fontSize: '1rem' }}>🛡️ Play Responsibly</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '0.75rem' }}>
            ScatterZZZ uses <strong>virtual chips only</strong> — for entertainment.
            Set a budget before playing, take breaks, and never chase losses.
            Chips have no real monetary value.
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="tx-card">
        <div className="tx-card__header">
          <span></span>
          <span>Description</span>
          <span>Date</span>
          <span>Amount</span>
        </div>

        {transactions.length === 0 ? (
          <div className="tx-empty">No transactions yet.</div>
        ) : (
          transactions.map(tx => {
            const meta = TX_META[tx.type] ?? { icon: '•', label: tx.type }
            const isPositive = tx.type !== 'bet'
            return (
              <div className="tx-row" key={tx.id}>
                <div className={`tx-icon tx-icon--${tx.type}`}>{meta.icon}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{meta.label}</div>
                  {tx.description && <div className="tx-desc">{tx.description}</div>}
                </div>
                <div className="tx-date">{formatDate(tx.created_at)}</div>
                <div className={`tx-amount ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '+' : '-'}{tx.amount.toLocaleString()}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── GCash Modal ──────────────────────────────── */}
      {gcashOpen && (
        <div className="gcash-modal-backdrop" onClick={e => e.target === e.currentTarget && closeGcash()}>
          <div className="gcash-modal">

            <div className="gcash-modal__header">
              <div className="gcash-logo">💙</div>
              <div>
                <div className="gcash-modal__title">GCash Payment</div>
                <div className="gcash-modal__sub">Simulated — no real money involved</div>
              </div>
            </div>

            {/* Step 1: Review */}
            {gcashStep === 1 && (
              <>
                <div className="gcash-summary">
                  <div className="gcash-row">
                    <span>Amount</span>
                    <strong>₱{phpAmount.toLocaleString()}</strong>
                  </div>
                  <div className="gcash-row">
                    <span>Chips to receive</span>
                    <strong>🪙 {chipsPreview.toLocaleString()}</strong>
                  </div>
                  <div className="gcash-row">
                    <span>Conversion rate</span>
                    <strong>₱1 = {chipsPerPhp} chips</strong>
                  </div>
                  <div className="gcash-total">
                    <span>Total</span>
                    <span style={{ color: 'var(--gold)' }}>₱{phpAmount.toLocaleString()}</span>
                  </div>
                </div>

                <ul className="gcash-steps">
                  <li>📱 This is a <strong>simulated</strong> GCash flow.</li>
                  <li>✅ No actual money is charged.</li>
                  <li>🪙 Chips are virtual currency only.</li>
                </ul>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn--outline" style={{ flex: 1 }} onClick={closeGcash}>
                    Cancel
                  </button>
                  <button className="btn btn--gold" style={{ flex: 2 }} onClick={() => setGcashStep(2)}>
                    Proceed
                  </button>
                </div>
              </>
            )}

            {/* Step 2: PIN entry */}
            {gcashStep === 2 && (
              <>
                <p style={{ textAlign: 'center', marginBottom: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Enter your GCash MPIN to confirm
                </p>
                <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                  <label>MPIN (any 4+ digits)</label>
                  <input
                    className="input"
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    autoFocus
                    style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.4rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setGcashStep(1)}>
                    Back
                  </button>
                  <button
                    className="btn btn--gold"
                    style={{ flex: 2 }}
                    onClick={handlePinConfirm}
                    disabled={pin.length < 4 || walletLoading}
                  >
                    {walletLoading
                      ? <span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#1a1100' }} />
                      : 'Confirm Payment'}
                  </button>
                </div>

                <p className="gcash-phone">
                  GCash number: <strong>09XX XXX XXXX</strong> (demo)
                </p>
              </>
            )}

            {/* Step 3: Success */}
            {gcashStep === 3 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
                <h3 style={{ color: 'var(--neon-green)', marginBottom: '0.5rem' }}>Payment Successful!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  {depositResult?.chips.toLocaleString()} chips have been added to your wallet.
                </p>
                <div className="chip-badge" style={{ margin: '0 auto 1.5rem', display: 'flex', width: 'fit-content' }}>
                  <span className="chip-icon">🪙</span>
                  +{depositResult?.chips.toLocaleString()} chips
                </div>
                <button className="btn btn--gold" style={{ width: '100%' }} onClick={closeGcash}>
                  Back to Wallet
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
