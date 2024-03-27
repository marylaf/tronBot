import {
  inlineHistoryArray,
  MAX_TRANSACTIONS_PER_MESSAGE,
  inlineTransArray,
} from "./constants.js";
import { getWalletAddressById, getWalletNameById } from "./db.js";
import {
  getUSDTBalance,
  formatTransactions,
  fetchTransactions,
} from "./tron.js";

export const handleHistoryMenu = (ctx) => {
  const startTextMessage = `Сколько последних транзакций показывать?`;
  const startCaptchaMessage = {
    reply_markup: {
      inline_keyboard: inlineHistoryArray,
    },
  };

  ctx.reply(startTextMessage, startCaptchaMessage);
};

export async function showTransactions(walletAddress, walletName, ctx, filter) {
  // const { offset, filterValue } = ctx.session.pagination;
  const transactions = await fetchTransactions(
    walletAddress,
    walletName,
    filter
  );
  if (transactions.length < 0) {
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
  const textBalanceMessage = await getUSDTBalance(walletAddress);
  await ctx.reply(textBalanceMessage, { parse_mode: "Markdown" });

  ctx.session.pagination.offset += transactions.length;
  await ctx.reply("Показать еще?", {
    reply_markup: {
      inline_keyboard: inlineTransArray,
    },
  });
}
