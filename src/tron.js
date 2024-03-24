import TronWeb from "tronweb";
import { usdtContractAddress } from "./constants.js";
import axios from "axios";
import { pool } from './db.js'

const tronWeb = new TronWeb({
  fullNode: "https://api.trongrid.io",
  solidityNode: "https://api.trongrid.io",
  eventServer: "https://api.trongrid.io",
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

export async function fetchTransactions(walletAddress, filterValue = 5) {
  filterValue = parseInt(filterValue, 10);
  const limit = 200;
  let offset = 0;
  const allUsdtTransactions = [];

  while (allUsdtTransactions.length < filterValue) {
    const url = `https://api.trongrid.io/v1/accounts/${walletAddress}/transactions/trc20`;

    try {
      const response = await axios.get(url, {
        params: { limit, start: offset },
        headers: { accept: "application/json" },
      });
      const transactions = response.data.data || [];
      const usdtTransactions = transactions.filter(
        (transaction) =>
          transaction.token_info.symbol === "USDT" &&
          parseInt(transaction.value, 10) /
            Math.pow(10, transaction.token_info.decimals) >=
            1
      );
      for (let transaction of usdtTransactions) {
        if (allUsdtTransactions.length < filterValue) {
          allUsdtTransactions.push(transaction);
        } else {
          break; // Прекращаем добавление, как только достигли filterValue
        }
      }
      if (
        transactions.length < limit ||
        allUsdtTransactions.length >= filterValue
      ) {
        break;
      } else {
        offset += limit;
      }
    } catch (error) {
      console.error(`Ошибка при получении транзакций: ${error}`);
    }
  }

  return allUsdtTransactions;
}

export async function fetchNewTransactions(
  walletAddress,
  lastKnownTransactionId
) {
  const limit = 50;
  const newUsdtTransactions = [];

  const url = `https://api.trongrid.io/v1/accounts/${walletAddress}/transactions/trc20`;

  try {
    const response = await axios.get(url, {
      params: { limit },
      headers: { accept: "application/json" },
    });
    const transactions = response.data.data || [];

    for (let transaction of transactions) {
      if (transaction.transaction_id === lastKnownTransactionId) {
        break;
      } else if (
        transaction.token_info.symbol === "USDT" &&
        parseInt(transaction.value, 10) /
          Math.pow(10, transaction.token_info.decimals) >=
          1
      ) {
        newUsdtTransactions.push(transaction);
      }
    }

    if (newUsdtTransactions.length > 0) {
      const latestTransactionId = newUsdtTransactions[0].transaction_id;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const updateQuery = `
          UPDATE wallets
          SET last_known_transaction_id = $1
          WHERE wallet_address = $2
        `;
        await client.query(updateQuery, [latestTransactionId, walletAddress]);
        await client.query("COMMIT");
      } catch (error) {
        console.error("Error updating last known transaction ID:", error);
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error(`Ошибка при получении новых транзакций: ${error}`);
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
