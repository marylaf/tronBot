import { Telegraf, session } from "telegraf";
import { config } from "dotenv";
import { Postgres } from "@telegraf/session/pg";
import { inlineMenuArray, MAX_TRANSACTIONS_PER_MESSAGE } from "./constants.js";
import { handleHistoryMenu, showTransactions } from "./history.js";
import {
  addNewWallet,
  checkWalletExists,
  sendUserWallets,
  deleteWallet,
  editWalletName,
  getAllSubscriptions,
  removeSubscription,
  getWalletAddressById,
  getWalletNameById,
} from "./db.js";
import {
  getUSDTBalance,
  formatTransactions,
  fetchNewTransactions,
} from "./tron.js";
import {
  handleWalletMenu,
  isValidWalletAddress,
  extractWalletAddressFromMessage,
} from "./wallets.js";

config();

const store = Postgres({
  user: process.env.POSTGRESQL_USER,
  host: process.env.POSTGRESQL_HOST,
  database: process.env.POSTGRESQL_DBNAME,
  password: process.env.POSTGRESQL_PASSWORD,
  port: process.env.POSTGRESQL_PORT,
});

const bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
  handlerTimeout: Infinity,
});

bot.use(session({ store, defaultSession: () => ({ count: 0 }) }));

// funсtion for opening start menu
const handleStartMenu = (ctx) => {
  const startTextMessage = `Вы можете воспользоваться следующими командами:`;
  const startCaptchaMessage = {
    reply_markup: {
      inline_keyboard: inlineMenuArray,
    },
  };

  ctx.reply(startTextMessage, startCaptchaMessage);
};

bot.start((ctx) => handleStartMenu(ctx));
bot.command("menu", (ctx) => {
  ctx.session.awaitingWalletAddress = false;
  ctx.session.awaitingWalletName = false;
  ctx.session.awaitingNewName = false;
  handleStartMenu(ctx);
});

// command for menu array
bot.on("callback_query", async (ctx) => {
  try {
    const ctxData = ctx.update.callback_query.data;
    const textWalletsMessage = "Введите адрес вашего USDT кошелька 💸";

    const deleteMatch = ctxData.match(/^delete_(.+)$/);
    if (deleteMatch) {
      const walletId = deleteMatch[1];
      try {
        const walletAddress = await deleteWallet(walletId);
        await ctx.reply(`Кошелек ${walletAddress} удален.`);
      } catch (error) {
        console.error(`Ошибка при удалении кошелька: ${error.message}`);
      }
      return;
    }

    const editMatch = ctxData.match(/^edit_(.+)$/);
    if (editMatch) {
      const walletId = editMatch[1];
      ctx.session.walletIdForEdit = walletId;
      ctx.session.awaitingNewName = true;
      await ctx.reply("Как переименовать этот кошелек?");
      return;
    }

    const showMatch = ctxData.match(/^show_(.+)$/);
    if (showMatch) {
      const walletId = showMatch[1];
      try {
        const walletAddress = await getWalletAddressById(walletId);
        const walletName = await getWalletNameById(walletId);
        ctx.session.pagination = {
          offset: 0,
        };
        await showTransactions(walletAddress, walletName, ctx);
      } catch (error) {
        console.error(`Ошибка при показе всех транзакций: ${error.message}`);
      }
      return;
    }

    switch (ctxData) {
      //inline keyboard menu
      case "wallets":
        handleWalletMenu(ctx);
        ctx.session.awaitingWalletAddress = false;
        ctx.session.awaitingWalletName = false;
        ctx.session.awaitingNewName = false;
        break;

      case "history":
        handleHistoryMenu(ctx);
        break;

      case "transactions":
        sendUserWallets(ctx, "transaction");
        break;

      //inline keyboard wallets
      case "addNew":
        ctx.reply(textWalletsMessage);
        ctx.session.awaitingWalletAddress = true;
        break;

      case "allWallets":
        sendUserWallets(ctx, "wallet");
        ctx.session.awaitingWalletAddress = false;
        ctx.session.awaitingWalletName = false;
        ctx.session.awaitingNewName = false;
        break;

      case "more":
        const walletAddress = ctx.session.walletAddress;
        const walletName = ctx.session.walletName;

        await showTransactions(walletAddress, walletName, ctx);

        break;

      case "return":
        handleStartMenu(ctx);
        break;

      //inline keyboard filter
      case "20":
      case "5":
      case "10":
        ctx.session.filter = ctxData;
        ctx.reply(`Фильтр на *${ctxData}* транзакций установлен.`, {
          parse_mode: "Markdown",
        });
        sendUserWallets(ctx, "transaction");
        break;
    }
  } catch (error) {
    console.error(`Ошибка: ${error.message}`, error);
  }
});

bot.on("message", async (ctx) => {
  const userId = ctx.update.message.from.id;
  const username = ctx.update.message.from.username;

  if (ctx.session.awaitingWalletAddress) {
    const walletAddress = extractWalletAddressFromMessage(
      ctx.update.message.text
    );

    if (!isValidWalletAddress(walletAddress)) {
      await ctx.reply("Адрес не подходит, попробуйте еще раз.");
      return;
    }

    const isWalletExists = await checkWalletExists(
      userId,
      username,
      walletAddress
    );

    if (isWalletExists) {
      await ctx.reply(
        "Этот адрес кошелька уже добавлен для данного пользователя."
      );
      return;
    }

    const textBalanceMessage = await getUSDTBalance(walletAddress);
    await ctx.reply(textBalanceMessage, { parse_mode: "Markdown" });

    ctx.session.walletAddress = walletAddress;
    ctx.session.awaitingWalletAddress = false;
    ctx.session.awaitingWalletName = true;
    await ctx.reply("Как назвать этот кошелек?");
    return;
  }

  if (ctx.session.awaitingWalletName) {
    const walletName = ctx.update.message.text;
    const walletAddress = ctx.session.walletAddress;

    await addNewWallet(userId, username, walletAddress, walletName, ctx);

    ctx.session.awaitingWalletName = false;
    delete ctx.session.walletAddress;
    return;
  }

  if (ctx.session.awaitingNewName) {
    const newName = ctx.update.message.text;
    const walletId = ctx.session.walletIdForEdit;
    try {
      await editWalletName(walletId, newName);
      await ctx.reply(`Имя кошелька успешно изменено на: ${newName}`);
    } catch (error) {
      console.log(`Ошибка при редактировании имени кошелька: ${error.message}`);
      await ctx.reply(
        "Произошла ошибка при попытке изменить имя кошелька. Пожалуйста, попробуйте еще раз."
      );
    }
    ctx.session.awaitingNewName = false;
    delete ctx.session.walletIdForEdit;
    return;
  }

  await ctx.reply(
    "Нужно выбрать команду из меню. Я не отвечаю на сообщения в чате 🦾🤖"
  );
});

export async function sendMessageToAllUsers() {
  const subscriptions = await getAllSubscriptions();
  for (const subscription of subscriptions) {
    try {
      console.log("DO TRANS");
      const walletAddress = subscription.walletAddress;
      const lastKnownTransactionId = subscription.lastKnownTransactionId;
      const newTransactions = await fetchNewTransactions(
        walletAddress,
        lastKnownTransactionId
      );

      if (newTransactions.length > 0) {
        for (
          let i = 0;
          i < newTransactions.length;
          i += MAX_TRANSACTIONS_PER_MESSAGE
        ) {
          const transactionsChunk = newTransactions.slice(
            i,
            i + MAX_TRANSACTIONS_PER_MESSAGE
          );
          let message = formatTransactions(
            transactionsChunk,
            subscription.walletName,
            subscription.walletAddress
          );
          await bot.telegram.sendMessage(subscription.chatId, message, {
            parse_mode: "Markdown",
          });
        }
      }
    } catch (e) {
      console.error(
        `Ошибка при отправке сообщения пользователю с ID ${subscription.chatId}: ${e}`
      );

      if (e.code === 403) {
        await removeSubscription(subscription.chatId);
        console.log(
          `Подписка для chatId: ${subscription.chatId} удалена из-за блокировки бота.`
        );
      }
    }
  }
}

sendMessageToAllUsers();
setInterval(() => {
  sendMessageToAllUsers();
}, 30000);

bot.launch();
