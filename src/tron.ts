import axios, { type AxiosInstance } from "axios";
import TronWeb from "tronweb";
import { usdtContractAddress } from "./constants.js";
import { AppDataSource } from "./data-source.js";
import { Wallet } from "./entity/Wallet.js";

const tronHeaders: Record<string, string> | undefined = process.env.TRONGRID_API_KEY
  ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
  : undefined;

const tronWeb = new TronWeb({
  fullNode: "https://api.trongrid.io",
  solidityNode: "https://api.trongrid.io",
  eventServer: "https://api.trongrid.io",
  headers: tronHeaders,
});

export const tron: AxiosInstance = axios.create({
  baseURL: "https://api.trongrid.io",
  timeout: 15000,
  headers: {
    accept: "application/json",
    ...(tronHeaders ?? {}),
  },
});

tronWeb.setAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");

export async function getUSDTBalance(walletAddress: string): Promise<string> {
  try {
    const contract = await tronWeb.contract().at(usdtContractAddress);
    const balance = await contract.balanceOf(walletAddress).call();
    const balanceInUSDT = (
      tronWeb.toBigNumber(balance as string | number).toNumber() / 1_000_000
    ).toFixed();
    return `Текущий баланс: *${balanceInUSDT}* USDT`;
  } catch (error) {
    console.error("Ошибка при получении баланса USDT:", error);
    return "Не удалось получить баланс USDT.";
  }
}

export interface Trc20Transaction {
  transaction_id: string;
  token_info?: { symbol?: string; decimals?: string | number };
  from?: string;
  to?: string;
  value?: string;
}

interface TronTrc20ListResponse {
  data?: Trc20Transaction[];
  meta?: { fingerprint?: string };
}

export async function fetchTransactions(
  walletAddress: string,
  filterValue: string | number,
  fingerprint: string | null | undefined = null
): Promise<{ transactions: Trc20Transaction[]; nextFingerprint?: string }> {
  const targetCount = parseInt(String(filterValue), 10);
  const limit = targetCount;
  const allUsdtTransactions: Trc20Transaction[] = [];
  let fp: string | undefined = fingerprint ?? undefined;

  while (allUsdtTransactions.length < targetCount) {
    const url = `/v1/accounts/${walletAddress}/transactions/trc20`;
    const params: { limit: number; fingerprint?: string } = {
      limit,
      ...(fp ? { fingerprint: fp } : {}),
    };

    try {
      const { data } = await tron.get<TronTrc20ListResponse>(url, { params });
      const transactions = data?.data ?? [];

      const usdtTransactions = transactions.filter((tx) => {
        const token = tx?.token_info;
        if (!token) return false;
        const isUSDT = token.symbol === "USDT";
        const decimals = Number(token.decimals ?? 6);
        const amount = Number(tx?.value ?? 0) / 10 ** decimals;
        return isUSDT && amount >= 1;
      });

      for (const tx of usdtTransactions) {
        if (allUsdtTransactions.length < targetCount) {
          allUsdtTransactions.push(tx);
        } else {
          break;
        }
      }

      fp = data?.meta?.fingerprint;

      if (transactions.length < limit || allUsdtTransactions.length >= targetCount) {
        break;
      }
    } catch (error) {
      console.error(
        "Ошибка при получении транзакций:",
        error instanceof Error ? error.message : error
      );
      break;
    }
  }

  return { transactions: allUsdtTransactions, nextFingerprint: fp };
}

export async function fetchNewTransactions(
  walletAddress: string,
  lastKnownTransactionId: string
): Promise<Trc20Transaction[]> {
  const pageLimit = 50;
  const maxPages = 5;
  const newUsdtTransactions: Trc20Transaction[] = [];

  let fingerprint: string | undefined;
  let pages = 0;
  let stop = false;

  try {
    while (!stop && pages < maxPages) {
      const { data } = await tron.get<TronTrc20ListResponse>(
        `/v1/accounts/${walletAddress}/transactions/trc20`,
        {
          params: {
            limit: pageLimit,
            ...(fingerprint ? { fingerprint } : {}),
          },
        }
      );

      const transactions = data?.data ?? [];
      if (!transactions.length) break;

      for (const tx of transactions) {
        if (tx?.transaction_id === lastKnownTransactionId) {
          stop = true;
          break;
        }

        const token = tx?.token_info;
        if (!token) continue;
        const isUSDT = token.symbol === "USDT";
        const decimals = Number(token.decimals ?? 6);
        const amount = Number(tx?.value ?? 0) / 10 ** decimals;

        if (isUSDT && amount >= 1) {
          newUsdtTransactions.push(tx);
        }
      }

      if (stop) break;

      fingerprint = data?.meta?.fingerprint;
      if (!fingerprint || transactions.length < pageLimit) break;

      pages += 1;
    }

    if (newUsdtTransactions.length > 0) {
      const latestTransactionId = newUsdtTransactions[0].transaction_id;
      try {
        await AppDataSource.getRepository(Wallet).update(
          { walletAddress },
          { lastKnownTransactionId: latestTransactionId }
        );
      } catch (error) {
        console.error("Error updating last known transaction ID:", error);
      }
    }
  } catch (error) {
    console.error(
      "Ошибка при получении новых транзакций:",
      error instanceof Error ? error.message : error
    );
  }

  return newUsdtTransactions.reverse();
}

export function formatTransactions(
  transactions: Trc20Transaction[],
  walletName: string,
  walletAddress: string
): string {
  if (transactions.length === 0) {
    return "Транзакции USDT не найдены.";
  }

  const messages = transactions.map((transaction) => {
    const txID = transaction.transaction_id;
    const token_info = transaction.token_info;
    const from = transaction.from ?? "";
    const to = transaction.to ?? "";
    const value = transaction.value ?? "0";
    const decimals = Number(token_info?.decimals ?? 6);
    const amount = parseInt(value, 10) / 10 ** decimals;

    let message = `Кошелек: *${walletName}*\nНа Сумму: *${amount.toFixed(
      2
    )}* ${token_info?.symbol ?? ""} 💵\n\nОт: \`${from}\`\nКому: \`${to}\`\n\nHASH: \`${txID}\``;
    const transactionDirection =
      from.toLowerCase() === walletAddress.toLowerCase()
        ? "❌ Исходящая транзакция"
        : "✅ Входящая транзакция";
    message = `${transactionDirection}\n\n${message}`;

    return message;
  });

  return messages.filter(Boolean).join("\n\n");
}
