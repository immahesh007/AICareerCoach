-- Migration 006: Create users and login_history tables for authentication
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT  uq_users_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

CREATE TABLE IF NOT EXISTS login_history (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address  VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS ix_login_history_user_id ON login_history(user_id);
