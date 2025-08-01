import axios from "axios";
import TronWeb from "tronweb";
import { usdtContractAddress } from "./constants.js";
import { pool } from "./db.js";

const tronHeaders = process.env.TRONGRID_API_KEY
  ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
  : undefined;

const tronWeb = new TronWeb({
  fullNode: "https://api.trongrid.io",
  solidityNode: "https://api.trongrid.io",
  eventServer: "https://api.trongrid.io",
  headers: tronHeaders,
});

export const tron = axios.create({
  baseURL: "https://api.trongrid.io",
  timeout: 15000,
  headers: {
    accept: "application/json",
    ...(tronHeaders || {}),
  },
});

tronWeb.setAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");

export async function getUSDTBalance(walletAddress) {
  try {
    const contract = await tronWeb.contract().at(usdtContractAddress);
    const balance = await contract.balanceOf(walletAddress).call();
    const balanceInUSDT = (
      tronWeb.toBigNumber(balance).toNumber() / 1000000
    ).toFixed();
    const textBalanceMessage = `Текущий баланс: *${balanceInUSDT}* USDT`;
    return textBalanceMessage;
  } catch (error) {
    console.error("Ошибка при получении баланса USDT:", error);
  }
}

export async function fetchTransactions(
  walletAddress,
  filterValue,
  fingerprint = null
) {
  filterValue = parseInt(filterValue, 10);
  const limit = filterValue; 
  const allUsdtTransactions = [];

  while (allUsdtTransactions.length < filterValue) {
    const url = `/v1/accounts/${walletAddress}/transactions/trc20`;
    const params = { limit, ...(fingerprint ? { fingerprint } : {}) };

    try {
      const { data } = await tron.get(url, { params });
      const transactions = data?.data || [];

      const usdtTransactions = transactions.filter((tx) => {
        const token = tx?.token_info;
        if (!token) return false;
        const isUSDT = token.symbol === "USDT";
        const decimals = Number(token.decimals ?? 6);
        const amount = Number(tx?.value ?? 0) / Math.pow(10, decimals);
        return isUSDT && amount >= 1;
      });

      for (const tx of usdtTransactions) {
        if (allUsdtTransactions.length < filterValue) {
          allUsdtTransactions.push(tx);
        } else {
          break;
        }
      }

      fingerprint = data?.meta?.fingerprint;

      if (
        transactions.length < limit ||
        allUsdtTransactions.length >= filterValue
      ) {
        break;
      }
    } catch (error) {
      console.error(
        "Ошибка при получении транзакций:",
        error?.message || error
      );
      break;
    }
  }

  return { transactions: allUsdtTransactions, nextFingerprint: fingerprint };
}

export async function fetchNewTransactions(
  walletAddress,
  lastKnownTransactionId
) {
  const pageLimit = 50;
  const maxPages = 5;
  const newUsdtTransactions = [];

  let fingerprint = undefined;
  let pages = 0;
  let stop = false;

  try {
    while (!stop && pages < maxPages) {
      const { data } = await tron.get(
        `/v1/accounts/${walletAddress}/transactions/trc20`,
        {
          params: { limit: pageLimit, ...(fingerprint ? { fingerprint } : {}) },
        }
      );

      const transactions = data?.data || [];
      if (!transactions.length) break;

      for (const tx of transactions) {
        if (tx?.transaction_id === lastKnownTransactionId) {
          stop = true; // дошли до последнего известного
          break;
        }

        const token = tx?.token_info;
        if (!token) continue;
        const isUSDT = token.symbol === "USDT";
        const decimals = Number(token.decimals ?? 6);
        const amount = Number(tx?.value ?? 0) / Math.pow(10, decimals);

        if (isUSDT && amount >= 1) {
          newUsdtTransactions.push(tx);
        }
      }

      if (stop) break;

      fingerprint = data?.meta?.fingerprint;
      if (!fingerprint || transactions.length < pageLimit) break;

      pages++;
    }

    // если нашли новые — обновим last_known_transaction_id на самый свежий
    if (newUsdtTransactions.length > 0) {
      const latestTransactionId = newUsdtTransactions[0].transaction_id;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE wallets
           SET last_known_transaction_id = $1
           WHERE wallet_address = $2`,
          [latestTransactionId, walletAddress]
        );
        await client.query("COMMIT");
      } catch (error) {
        console.error("Error updating last known transaction ID:", error);
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error(
      "Ошибка при получении новых транзакций:",
      error?.message || error
    );
  }

  return newUsdtTransactions.reverse();
}

export function formatTransactions(transactions, walletName, walletAddress) {
  if (transactions.length === 0) {
    return "Транзакции USDT не найдены.";
  } else {
    const messages = transactions.map((transaction) => {
      const { transaction_id: txID, token_info, from, to, value } = transaction;
      const amount = parseInt(value, 10) / Math.pow(10, token_info.decimals);

      let message = `Кошелек: *${walletName}*\nНа Сумму: *${amount.toFixed(
        2
      )}* ${
        token_info.symbol
      } 💵\n\nОт: \`${from}\`\nКому: \`${to}\`\n\nHASH: \`${txID}\``;
      const transactionDirection =
        from.toLowerCase() === walletAddress.toLowerCase()
          ? "❌ Исходящая транзакция"
          : "✅ Входящая транзакция";
      message = `${transactionDirection}\n\n${message}`;

      return message;
    });

    return messages.join("\n\n");
  }
}
