import { DataSource } from "typeorm";
import type { Pool } from "pg";
import { PostgresDriver } from "typeorm/driver/postgres/PostgresDriver.js";
import { getPgConnectionOptions } from "./config.js";
import { Wallet } from "./entity/Wallet.js";

const url = process.env.DATABASE_URL?.trim();

const baseOptions = {
  type: "postgres" as const,
  entities: [Wallet],
  synchronize: process.env.TYPEORM_SYNCHRONIZE === "true",
  logging: process.env.TYPEORM_LOGGING === "true",
};

export const AppDataSource = url
  ? new DataSource({
      ...baseOptions,
      url,
    })
  : (() => {
      const o = getPgConnectionOptions();
      return new DataSource({
        ...baseOptions,
        host: o.host,
        port: o.port,
        username: o.user,
        password: o.password,
        database: o.database,
      });
    })();

/** Общий пул `pg` для `@telegraf/session/pg` (тот же, что использует TypeORM). */
export function getSessionPgPool(): Pool {
  if (!AppDataSource.isInitialized) {
    throw new Error("AppDataSource.initialize() ещё не вызван");
  }
  return (AppDataSource.driver as PostgresDriver).master as Pool;
}
