--+------------------------------------------------------------------+
--| PsychoBot AWS RDS PostgreSQL Schema — Phase 1 Initial Setup    |
--| Created: 2026-05-29                                             |
--| Purpose: Persist conversations, contacts, messages, events     |
--+------------------------------------------------------------------+

-- ========== CONVERSATIONS IA ==========
CREATE TABLE IF NOT EXISTS conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_jid VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    model_used VARCHAR(100) DEFAULT 'llama-3.3-70b',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_jid_date
    ON conversation_history(contact_jid, created_at DESC);

-- View: historique récent par contact (90 jours)
CREATE OR REPLACE VIEW v_recent_conversations AS
SELECT contact_jid, role, content, created_at
FROM conversation_history
WHERE created_at >= NOW() - INTERVAL '90 days'
ORDER BY contact_jid, created_at;

-- ========== CONTACTS ACCUEILLIS ==========
CREATE TABLE IF NOT EXISTS greeted_contacts (
    contact_jid VARCHAR(100) PRIMARY KEY,
    first_greeted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_greeted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    greeting_count INTEGER DEFAULT 1,
    CONSTRAINT positive_count CHECK (greeting_count > 0)
);

-- ========== CACHE MESSAGES (antidelete/ViewOnce) ==========
CREATE TABLE IF NOT EXISTS message_cache (
    message_id VARCHAR(100) PRIMARY KEY,
    remote_jid VARCHAR(100) NOT NULL,
    sender_jid VARCHAR(100),
    message_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_jid_date
    ON message_cache(remote_jid, cached_at DESC);

-- Auto-cleanup function: supprimer messages > 7 jours
CREATE OR REPLACE FUNCTION cleanup_old_message_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM message_cache
    WHERE cached_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ========== PROFILS CONTACTS ENRICHIS ==========
CREATE TABLE IF NOT EXISTS contact_profiles (
    jid VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(200),
    phone_number VARCHAR(20),
    preferred_language VARCHAR(10) DEFAULT 'fr',
    timezone VARCHAR(50) DEFAULT 'Africa/Porto-Novo',
    first_interaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_interaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_messages INTEGER DEFAULT 0,
    total_commands INTEGER DEFAULT 0,
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_last_interaction
    ON contact_profiles(last_interaction DESC);

-- ========== CONTEXTE METIER (projets, leads) ==========
CREATE TABLE IF NOT EXISTS business_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_jid VARCHAR(100) NOT NULL,
    context_type VARCHAR(50) NOT NULL,
    subject VARCHAR(200),
    description TEXT,
    status VARCHAR(50) DEFAULT 'new',
    priority INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_contact_type
    ON business_context(contact_jid, context_type);
CREATE INDEX IF NOT EXISTS idx_business_status_priority
    ON business_context(status, priority DESC);

-- ========== LOGS COMMANDES TRADBOT ==========
CREATE TABLE IF NOT EXISTS tradbot_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_jid VARCHAR(100) NOT NULL,
    command VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) DEFAULT 'XAUUSD',
    request_data JSONB,
    response_data JSONB,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tradbot_contact_date
    ON tradbot_interactions(contact_jid, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tradbot_symbol_date
    ON tradbot_interactions(symbol, executed_at DESC);

-- ========== TABLES SYSTEM ==========
CREATE TABLE IF NOT EXISTS system_metadata (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert schema version
INSERT INTO system_metadata (key, value)
VALUES ('schema_version', '1.0.0')
ON CONFLICT (key) DO UPDATE SET value = '1.0.0';

INSERT INTO system_metadata (key, value)
VALUES ('initialized_at', NOW()::TEXT)
ON CONFLICT (key) DO UPDATE SET value = NOW()::TEXT;

-- ========== SUMMARY ==========
-- Schema initialized with 7 tables:
-- 1. conversation_history — IA message pairs
-- 2. greeted_contacts — Contact cooldown tracking
-- 3. message_cache — Antidelete/ViewOnce recovery
-- 4. contact_profiles — Enriched contact metadata
-- 5. business_context — Project/lead tracking
-- 6. tradbot_interactions — !tradbot command logs
-- 7. system_metadata — Version/initialization tracking
--
-- Total indexes: 8
-- Views: 1 (v_recent_conversations)
-- Functions: 1 (cleanup_old_message_cache)
--
-- Retention policies:
-- - conversation_history: 90 days (manual cleanup)
-- - message_cache: 7 days (auto via cleanup function)
-- - greeted_contacts: infinite (1 entry per contact)
-- - contact_profiles: infinite (growing)
-- - business_context: infinite (archive as needed)
-- - tradbot_interactions: infinite (archive as needed)
