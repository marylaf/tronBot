import axios from 'axios';
import { config } from 'dotenv';
import pkg from 'pg';
import { getUSDTBalance } from './tron.js';

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
    console.error('PostgreSQL connection error:', err);
  } else {
    console.log('PostgreSQL connected successfully', res.rows);
  }
});

export async function addNewWallet(
  userId,
  username,
  walletAddress,
  walletName,
  ctx
) {
  console.log(
    `🔹 [addNewWallet] Start for userId=${userId}, wallet=${walletAddress}, name=${walletName}`
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`🟢 [${userId}] BEGIN transaction`);

    const url = `https://api.trongrid.io/v1/accounts/${walletAddress}/transactions/trc20?limit=20`;
    console.log(`🌐 [${userId}] Fetching transactions from: ${url}`);

    const response = await axios.get(url, {
      headers: { accept: 'application/json' },
    });
    const transactions = response.data.data || [];
    console.log(
      `📦 [${userId}] Total transactions fetched: ${transactions.length}`
    );

    const usdtTransactions = transactions.filter(
      (tx) => tx.token_info?.symbol === 'USDT'
    );
    console.log(
      `💰 [${userId}] USDT transactions found: ${usdtTransactions.length}`
    );

    let lastKnownTransactionId = '0';
    if (usdtTransactions.length > 0) {
      lastKnownTransactionId = usdtTransactions[0].transaction_id;
      console.log(
        `🔑 [${userId}] Last known transaction ID: ${lastKnownTransactionId}`
      );
    } else {
      console.log(
        `⚠️ [${userId}] No USDT transactions found, using default ID 0`
      );
    }

    const insertQuery = `
      INSERT INTO wallets(user_id, username, wallet_address, wallet_name, last_known_transaction_id)
      VALUES($1, $2, $3, $4, $5)
      RETURNING id, wallet_address, wallet_name, created_at;
    `;

    const insertRes = await client.query(insertQuery, [
      Number(userId),
      username,
      walletAddress,
      walletName,
      lastKnownTransactionId,
    ]);

    await client.query('COMMIT');
    console.log(
      `✅ [${userId}] Wallet inserted successfully — ID: ${insertRes.rows[0].id}`
    );

    await ctx.reply('✅ Адрес кошелька успешно добавлен :)');

    return insertRes.rows[0];
  } catch (error) {
    console.error(`❌ [${userId}] Error adding wallet:`, error);
    try {
      await client.query('ROLLBACK');
      console.log(`🔁 [${userId}] Transaction rolled back`);
    } catch (rollbackErr) {
      console.error(`💥 [${userId}] Rollback failed:`, rollbackErr);
    }
  } finally {
    client.release();
    console.log(`🔚 [${userId}] Client connection released`);
  }
}

export async function checkWalletExists(userId, username, walletAddress) {
  const client = await pool.connect();
  try {
    const checkQuery =
      'SELECT * FROM wallets WHERE user_id = $1 AND username = $2 AND wallet_address = $3';
    const checkRes = await client.query(checkQuery, [
      userId,
      username,
      walletAddress,
    ]);
    return checkRes.rows.length > 0;
  } catch (error) {
    console.log('Error checking wallet existence:', error);
    return false;
  } finally {
    client.release();
  }
}

export async function getUserWallets(userId) {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM wallets WHERE user_id = $1';
    const { rows } = await client.query(query, [userId]);
    return rows;
  } catch (error) {
    console.error('Error retrieving user wallets:', error);
    return [];
  } finally {
    client.release();
  }
}

export async function sendUserWallets(ctx, context) {
  const userId = ctx.update.callback_query.from.id;
  const wallets = await getUserWallets(userId);

  if (wallets.length === 0) {
    await ctx.reply('На данный момент в системе нет кошельков.');
  } else {
    const textAllWalletsMessage =
      'На данный момент в системе есть следующие кошельки:';
    await ctx.reply(textAllWalletsMessage);

    for (const wallet of wallets) {
      const balance = await getUSDTBalance(wallet.wallet_address);
      const messageText =
        `*${wallet.wallet_name}*\n\n` +
        `Адрес - [${wallet.wallet_address}](https://tronscan.org/#/address/${wallet.wallet_address})\n\n` +
        balance;

      let buttons;

      if (context === 'transaction') {
        buttons = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Показать', callback_data: `show_${wallet.id}` }],
            ],
          },
        };
      } else if (context === 'wallet') {
        buttons = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Редактировать', callback_data: `edit_${wallet.id}` }],
              [{ text: 'Удалить', callback_data: `delete_${wallet.id}` }],
            ],
          },
        };
      }

      await ctx.reply(messageText, {
        reply_markup: buttons.reply_markup,
        disable_web_page_preview: true,
        parse_mode: 'Markdown',
      });
    }
  }
}

export async function deleteWallet(walletId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selectQuery = 'SELECT wallet_address FROM wallets WHERE id = $1';
    const selectRes = await client.query(selectQuery, [walletId]);
    if (selectRes.rows.length > 0) {
      const walletAddress = selectRes.rows[0].wallet_address;
      const deleteQuery = 'DELETE FROM wallets WHERE id = $1';
      await client.query(deleteQuery, [walletId]);
      await client.query('COMMIT');
      return walletAddress;
    } else {
      console.log(`Кошелек с номером ${walletAddress} не найден.`);
      return null;
    }
  } catch (error) {
    console.log('Ошибка при удалении кошелька:', error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

export async function editWalletName(walletId, newName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updateQuery = 'UPDATE wallets SET wallet_name = $1 WHERE id = $2';
    await client.query(updateQuery, [newName, walletId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getWalletAddressById(walletId) {
  const client = await pool.connect();
  try {
    const query = 'SELECT wallet_address FROM wallets WHERE id = $1';
    const { rows } = await client.query(query, [walletId]);
    if (rows.length > 0) {
      const walletAddress = rows[0].wallet_address;
      return walletAddress;
    } else {
      console.log('Кошелек не найден');
      return null;
    }
  } catch (error) {
    console.error('Ошибка при извлечении адреса кошелька:', error);
    return null;
  } finally {
    client.release();
  }
}

export async function getWalletNameById(walletId) {
  const client = await pool.connect();
  try {
    const query = 'SELECT wallet_name FROM wallets WHERE id = $1';
    const { rows } = await client.query(query, [walletId]);
    if (rows.length > 0) {
      const walletName = rows[0].wallet_name;
      return walletName;
    } else {
      console.log('Имя не найдено');
      return null;
    }
  } catch (error) {
    console.error('Ошибка при извлечении имени кошелька:', error);
    return null;
  } finally {
    client.release();
  }
}

export async function getAllSubscriptions() {
  const client = await pool.connect();

  try {
    const queryText =
      'SELECT user_id, wallet_address, wallet_name, last_known_transaction_id FROM wallets';
    const res = await client.query(queryText);
    return res.rows.map((row) => ({
      chatId: row.user_id,
      walletAddress: row.wallet_address,
      walletName: row.wallet_name,
      lastKnownTransactionId: row.last_known_transaction_id,
    }));
  } catch (error) {
    console.error('Ошибка при получении подписок:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function removeSubscription(chatId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM wallets WHERE "user_id" = $1', [chatId]);
  } catch (error) {
    console.log('Error removing subscription:', error);
  }
}
