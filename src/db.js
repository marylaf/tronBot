import pkg from 'pg';
import { config } from "dotenv";

config();

const { Pool } = pkg;

export const pool = new Pool({
  user: process.env.POSTGRESQL_USER,
  host: process.env.POSTGRESQL_HOST,
  database: process.env.DBNAME,
  password: process.env.POSTGRESQL_PASSWORD,
  port: process.env.POSTGRESQL_PORT,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("PostgreSQL connection error:", err);
  } else {
    console.log("PostgreSQL connected successfully", res.rows);
  }
});

export async function addNewWallet(userId, username, walletAddress, walletName) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    //   throw new Error("Этот адрес кошелька уже добавлен для данного пользователя.");
      const insertQuery = "INSERT INTO wallets(user_id, username, wallet_address, wallet_name) VALUES($1, $2, $3, $4) RETURNING *";
      const insertRes = await client.query(insertQuery, [userId, username, walletAddress, walletName]);
      await client.query("COMMIT");
      return insertRes.rows[0];
    } catch (error) {
    console.log("Error checking wallet adding:", error);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

export async function checkWalletExists(userId, username, walletAddress) {
  const client = await pool.connect();
  try {
    const checkQuery = "SELECT * FROM wallets WHERE user_id = $1 AND username = $2 AND wallet_address = $3";
    const checkRes = await client.query(checkQuery, [userId, username, walletAddress]);
    return checkRes.rows.length > 0;
  } catch (error) {
    console.log("Error checking wallet existence:", error);
    return false;
  } finally {
    client.release();
  }
}

// export async function addNameWallet(userId, walletName) {
//   const client = await pool.connect();
//   try {
//     await client.query("BEGIN");

//     const checkQuery = "SELECT * FROM wallets WHERE user_id = $1 AND wallet_address = $2";
//     const checkRes = await client.query(checkQuery, [userId, walletAddress]);

//     if (checkRes.rows.length > 0) {
//       await client.query("ROLLBACK");
//       throw new Error("Этот адрес кошелька уже добавлен для данного пользователя.");
//     } else {
//       const insertQuery = "INSERT INTO wallets(user_id, username, wallet_address) VALUES($1, $2, $3) RETURNING *";
//       const insertRes = await client.query(insertQuery, [userId, username, walletAddress]);
//       await client.query("COMMIT");
//       return insertRes.rows[0];
//     }
//   } catch (error) {
//     await client.query("ROLLBACK");
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// export async function removeSubscription(chatId) {
//   try {
//     await client.query('DELETE FROM subscriptions WHERE "chatId" = $1', [
//       chatId,
//     ]);
//   } catch (error) {
//     console.log("Error removing subscription:", error);
//   }
// }

// export async function getAllSubscriptions() {
//   try {
//     const res = await client.query("SELECT * FROM subscriptions");
//     return res.rows;
//   } catch (error) {
//     console.log("Error fetching subscriptions:", error);
//     return [];
//   }
// }
