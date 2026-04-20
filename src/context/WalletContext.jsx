// src/context/WalletContext.jsx
// ─────────────────────────────────────────────
// Manages chip balance and all chip transactions.
// ─────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const WalletContext = createContext(null)

// How many chips per 1 PHP
const CHIPS_PER_PHP = Number(import.meta.env.VITE_CHIPS_PER_PHP) || 10

export function WalletProvider({ children }) {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [walletLoading, setWalletLoading] = useState(false)

  // ── Fetch wallet balance ──────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (!error && data) setBalance(data.balance)
  }, [user])

  // ── Fetch recent transactions ─────────────────────────
  const fetchTransactions = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) setTransactions(data)
  }, [user])

  useEffect(() => {
    if (user) {
      fetchBalance()
      fetchTransactions()
    } else {
      setBalance(0)
      setTransactions([])
    }
  }, [user, fetchBalance, fetchTransactions])

  // ── Deduct chips for a bet ────────────────────────────
  // Returns true if successful, false if insufficient funds
  const placeBet = async (amount) => {
    if (!user || amount <= 0 || amount > balance) return false
    setWalletLoading(true)
    try {
      // Use Supabase RPC function for safe atomic deduction
      const { data, error } = await supabase.rpc('deduct_chips', {
        p_user_id: user.id,
        p_amount: amount,
        p_description: 'Bet placed',
      })
      if (error || data === false) return false
      setBalance(prev => prev - amount)
      return true
    } finally {
      setWalletLoading(false)
    }
  }

  // ── Add chips for a win ───────────────────────────────
  const addWinnings = async (amount, description = 'Win payout') => {
    if (!user || amount <= 0) return
    await supabase.rpc('add_chips', {
      p_user_id: user.id,
      p_amount: amount,
      p_type: 'win',
      p_description: description,
    })
    setBalance(prev => prev + amount)
  }

  // ── Deposit chips (simulated GCash) ───────────────────
  const depositChips = async (phpAmount) => {
    if (!user || phpAmount <= 0) return { success: false, chips: 0 }
    const chips = Math.floor(phpAmount * CHIPS_PER_PHP)
    setWalletLoading(true)
    try {
      await supabase.rpc('add_chips', {
        p_user_id: user.id,
        p_amount: chips,
        p_type: 'deposit',
        p_description: `GCash deposit ₱${phpAmount}`,
      })
      setBalance(prev => prev + chips)
      await fetchTransactions()
      return { success: true, chips }
    } finally {
      setWalletLoading(false)
    }
  }

  return (
    <WalletContext.Provider value={{
      balance,
      transactions,
      walletLoading,
      placeBet,
      addWinnings,
      depositChips,
      fetchBalance,
      fetchTransactions,
      chipsPerPhp: CHIPS_PER_PHP,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}
