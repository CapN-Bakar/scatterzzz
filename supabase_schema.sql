-- ============================================================
-- ScatterZZZ Casino Platform — Supabase Schema
-- Run this in Supabase > SQL Editor
-- ============================================================

-- 1. USERS TABLE
-- Extends Supabase auth.users with display info
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_color TEXT DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WALLETS TABLE
-- One wallet per user
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance BIGINT DEFAULT 1000,    -- balance in chips (starts with 1000 free chips)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRANSACTIONS TABLE
-- Audit log of all chip movements
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'bet', 'win', 'bonus')),
  amount BIGINT NOT NULL,          -- always positive; direction inferred from type
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GAME HISTORY TABLE
CREATE TABLE public.game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK (game IN ('lucky_leprechaun', 'wild_west')),
  bet_amount BIGINT NOT NULL,
  result TEXT NOT NULL,            -- e.g. 'win', 'lose', 'jackpot'
  symbols JSONB,                   -- e.g. ["clover","coin","rainbow"]
  payout BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

-- Users: can only read/update their own record
CREATE POLICY "Users can view own record" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own record" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Wallets: can only access own wallet
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions: can only read own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Game history: can only read own game history
CREATE POLICY "Users can view own game history" ON public.game_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game history" ON public.game_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create user profile + wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into users
  INSERT INTO public.users (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email, '@', 1)  -- default username from email
  );

  -- Create wallet with 1000 bonus chips
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 1000);

  -- Record welcome bonus transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (NEW.id, 'bonus', 1000, 'Welcome bonus chips!');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to safely deduct chips (prevents negative balance)
CREATE OR REPLACE FUNCTION public.deduct_chips(
  p_user_id UUID,
  p_amount BIGINT,
  p_description TEXT DEFAULT 'bet'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance BIGINT;
BEGIN
  SELECT balance INTO current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;  -- lock row

  IF current_balance < p_amount THEN
    RETURN FALSE;  -- insufficient funds
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bet', p_amount, p_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add chips (win or deposit)
CREATE OR REPLACE FUNCTION public.add_chips(
  p_user_id UUID,
  p_amount BIGINT,
  p_type TEXT DEFAULT 'win',
  p_description TEXT DEFAULT 'win'
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, p_type, p_amount, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
