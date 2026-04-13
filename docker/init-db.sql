-- Схема приложения (сессии Telegraf создаёт @telegraf/session/pg при необходимости)
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT,
  wallet_address TEXT NOT NULL,
  wallet_name TEXT NOT NULL,
  last_known_transaction_id TEXT NOT NULL DEFAULT '0',
  UNIQUE (user_id, wallet_address)
);
