import { config as loadEnv } from "dotenv";

loadEnv();

export interface PgConnectionOptions {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

function parseDatabaseUrl(url: string): PgConnectionOptions {
  const u = new URL(url);
  const database = u.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL: в пути должен быть указан имя базы данных");
  }
  const port = u.port ? Number(u.port) : 5432;
  const user = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  return {
    host: u.hostname,
    port,
    database,
    user,
    password,
  };
}

/**
 * Настройки подключения: приоритет у DATABASE_URL, иначе POSTGRESQL_*.
 */
export function getPgConnectionOptions(): PgConnectionOptions {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return parseDatabaseUrl(url);
  }

  const database =
    process.env.POSTGRESQL_DATABASE?.trim() ||
    process.env.POSTGRESQL_DBNAME?.trim() ||
    process.env.DBNAME?.trim();

  if (!database) {
    throw new Error(
      "Задайте DATABASE_URL или POSTGRESQL_DATABASE (и остальные POSTGRESQL_*)."
    );
  }

  return {
    user: process.env.POSTGRESQL_USER ?? "postgres",
    password: process.env.POSTGRESQL_PASSWORD ?? "",
    host: process.env.POSTGRESQL_HOST ?? "127.0.0.1",
    port: Number(process.env.POSTGRESQL_PORT ?? 5432),
    database,
  };
}
