import type { DataSource } from "typeorm";

/** Совпадает с `docker/init-db.sql` и сущностью `Wallet`. */
const CREATE_WALLETS_TABLE = `
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT,
  wallet_address TEXT NOT NULL,
  wallet_name TEXT NOT NULL,
  last_known_transaction_id TEXT NOT NULL DEFAULT '0',
  UNIQUE (user_id, wallet_address)
);
`;

/**
 * Гарантирует наличие таблицы кошельков (пустая БД после CREATE DATABASE).
 * При TYPEORM_SYNCHRONIZE=true запрос идемпотентен.
 */
export async function ensureWalletsTable(ds: DataSource): Promise<void> {
  await ds.query(CREATE_WALLETS_TABLE);
}
