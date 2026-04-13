import { Client } from "pg";
import { getPgConnectionOptions } from "./config.js";

/** Имя БД для подключения перед CREATE DATABASE (обычно `postgres`). */
const maintenanceDatabase =
  process.env.POSTGRES_MAINTENANCE_DATABASE?.trim() || "postgres";

/**
 * Имя базы из конфигурации: только безопасные идентификаторы PostgreSQL.
 * Иначе авто-создание отключено — подставлять в SQL нельзя.
 */
const SAFE_DB_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

/**
 * Подключается к служебной БД и создаёт целевую, если её ещё нет.
 */
export async function ensurePostgresDatabaseExists(): Promise<void> {
  const opts = getPgConnectionOptions();

  if (!SAFE_DB_IDENTIFIER.test(opts.database)) {
    throw new Error(
      `Имя базы «${opts.database}» не подходит для авто-создания: допустимы латинские буквы, цифры и _, длина до 63 символов, первый символ — не цифра.`
    );
  }

  const admin = new Client({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password,
    database: maintenanceDatabase,
  });

  await admin.connect();
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [opts.database]
    );
    if ((exists.rowCount ?? 0) > 0) {
      return;
    }

    try {
      await admin.query(`CREATE DATABASE ${opts.database}`);
      console.log(`База данных «${opts.database}» создана.`);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === "42P04") {
        return;
      }
      throw e;
    }
  } finally {
    await admin.end();
  }
}
