import type { Context } from "telegraf";
import {
  inlineHistoryArray,
  MAX_TRANSACTIONS_PER_MESSAGE,
  inlineTransArray,
} from "./constants.js";
import { getUSDTBalance, formatTransactions, fetchTransactions } from "./tron.js";
import type { BotSession } from "./types/session.js";

type SessionContext = Context & { session: BotSession };

export function handleHistoryMenu(ctx: SessionContext): void {
  const startTextMessage = `Сколько последних транзакций показывать?`;
  const startCaptchaMessage = {
    reply_markup: {
      inline_keyboard: inlineHistoryArray,
    },
  };

  void ctx.reply(startTextMessage, startCaptchaMessage);
}

export async function showTransactions(
  walletAddress: string | null,
  walletName: string | null,
  ctx: SessionContext,
  useFingerprint: boolean
): Promise<void> {
  if (!walletAddress || !walletName) {
    await ctx.reply("Не удалось определить кошелёк.");
    return;
  }

  const filter = ctx.session.filter ?? 5;
  const fingerprint = useFingerprint
    ? ctx.session.pagination?.fingerprint
    : undefined;
  const { transactions, nextFingerprint } = await fetchTransactions(
    walletAddress,
    filter,
    fingerprint
  );

  if (transactions.length <= 0) {
    await ctx.reply("Больше транзакций нет.");
    return;
  }

  if (transactions.length > MAX_TRANSACTIONS_PER_MESSAGE) {
    for (
      let i = 0;
      i < transactions.length;
      i += MAX_TRANSACTIONS_PER_MESSAGE
    ) {
      const transactionsChunk = transactions.slice(
        i,
        i + MAX_TRANSACTIONS_PER_MESSAGE
      );
      const formatMessage = formatTransactions(
        transactionsChunk,
        walletName,
        walletAddress
      );
      await ctx.reply(formatMessage, { parse_mode: "Markdown" });
    }
  } else {
    const formatMessage = formatTransactions(
      transactions,
      walletName,
      walletAddress
    );
    await ctx.reply(formatMessage, { parse_mode: "Markdown" });
  }

  ctx.session.pagination = { fingerprint: nextFingerprint };
  ctx.session.walletAddress = walletAddress;
  ctx.session.walletName = walletName;

  await ctx.reply("Показать еще?", {
    reply_markup: {
      inline_keyboard: inlineTransArray,
    },
  });

  const textBalanceMessage = await getUSDTBalance(walletAddress);
  await ctx.reply(textBalanceMessage, { parse_mode: "Markdown" });
}
