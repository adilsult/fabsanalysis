-- ============================================
-- Beauty Platform — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Subscriptions (one-time lifetime access)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'lifetime' | 'pending' | 'refunded'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);

-- Saved face analyses
CREATE TABLE IF NOT EXISTS public.face_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  image_url TEXT,
  analysis_result JSONB
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS face_analyses_user_id_idx ON public.face_analyses(user_id);
CREATE INDEX IF NOT EXISTS face_analyses_created_at_idx ON public.face_analyses(created_at DESC);

-- ============================
-- Row Level Security Policies
-- ============================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_analyses ENABLE ROW LEVEL SECURITY;

-- Subscriptions: users can only read their own
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Analyses: users can read and insert their own
CREATE POLICY "Users can read own analyses"
  ON public.face_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON public.face_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (for server-side inserts via SUPABASE_SERVICE_KEY)
-- Service role automatically bypasses RLS
