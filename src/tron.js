import TronWeb from "tronweb";
import { usdtContractAddress } from "./constants.js";
import axios from "axios";

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

export async function fetchAndFormatTransactions(
  walletAddress,
  walletName,
  filterValue = 5
) {
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
        (transaction) => transaction.token_info.symbol === "USDT"
      );
      for (let transaction of usdtTransactions) {
        if (allUsdtTransactions.length < filterValue) {
          allUsdtTransactions.push(transaction);
        } else {
          break; // Прекращаем добавление, как только достигли filterValue
        }
      }
      console.log(allUsdtTransactions.length, filterValue);
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

  if (allUsdtTransactions.length === 0) {
    return "Транзакции USDT не найдены.";
  } else {
    const messages = allUsdtTransactions
      .map((transaction) => {
        const {
          transaction_id: txID,
          token_info,
          from,
          to,
          value,
        } = transaction;
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
