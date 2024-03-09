import pkg from "pg";
import { config } from "dotenv";
import { getUSDTBalance } from "./tron.js";

config();

const { Pool } = pkg;

export const pool = new Pool({
  user: process.env.POSTGRESQL_USER,
  host: process.env.POSTGRESQL_HOST,
  database: process.env.DBNAME,
  password: process.env.POSTGRESQL_PASSWORD,
  port: process.env.POSTGRESQL_PORT,
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("PostgreSQL connection error:", err);
  } else {
    console.log("PostgreSQL connected successfully", res.rows);
  }
});

export async function addNewWallet(
  userId,
  username,
  walletAddress,
  walletName
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertQuery =
      "INSERT INTO wallets(user_id, username, wallet_address, wallet_name) VALUES($1, $2, $3, $4) RETURNING *";
    const insertRes = await client.query(insertQuery, [
      userId,
      username,
      walletAddress,
      walletName,
    ]);
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
    const checkQuery =
      "SELECT * FROM wallets WHERE user_id = $1 AND username = $2 AND wallet_address = $3";
    const checkRes = await client.query(checkQuery, [
      userId,
      username,
      walletAddress,
    ]);
    return checkRes.rows.length > 0;
  } catch (error) {
    console.log("Error checking wallet existence:", error);
    return false;
  } finally {
    client.release();
  }
}

export async function getUserWallets(userId) {
  const client = await pool.connect();
  try {
    const query = "SELECT * FROM wallets WHERE user_id = $1";
    const { rows } = await client.query(query, [userId]);
    return rows;
  } catch (error) {
    console.error("Error retrieving user wallets:", error);
    return [];
  } finally {
    client.release();
  }
}

export async function sendUserWallets(ctx) {
  const userId = ctx.update.callback_query.from.id;
  const wallets = await getUserWallets(userId);

  if (wallets.length === 0) {
    await ctx.reply("На данный момент в системе нет кошельков.");
  } else {
    const textAllWalletsMessage =
      "На данный момент в системе есть следующие кошельки:";
    await ctx.reply(textAllWalletsMessage);

    for (const wallet of wallets) {
      const balance = await getUSDTBalance(wallet.wallet_address);
      const messageText =
        `*${wallet.wallet_name}*\n\n` +
        `Адрес - [${wallet.wallet_address}](https://tronscan.org/#/address/${wallet.wallet_address})\n\n` +
        balance;

      const buttons = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Редактировать", callback_data: `edit_${wallet.id}` }],
            [{ text: "Удалить", callback_data: `delete_${wallet.id}` }],
          ],
        },
      };

      await ctx.reply(messageText, {
        reply_markup: buttons.reply_markup,
        disable_web_page_preview: true,
        parse_mode: "Markdown",
      });
    }
  }
}

export async function deleteWallet(walletId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selectQuery = "SELECT wallet_address FROM wallets WHERE id = $1";
    const selectRes = await client.query(selectQuery, [walletId]);
    if (selectRes.rows.length > 0) {
      const walletAddress = selectRes.rows[0].wallet_address;
      const deleteQuery = "DELETE FROM wallets WHERE id = $1";
      await client.query(deleteQuery, [walletId]);
      await client.query("COMMIT");
      return walletAddress;
    } else {
      console.log(`Кошелек с номером ${walletAddress} не найден.`);
      return null;
    }
  } catch (error) {
    console.log("Ошибка при удалении кошелька:", error);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}
