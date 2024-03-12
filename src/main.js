import { Telegraf, session } from "telegraf";
import { config } from "dotenv";
import { Postgres } from "@telegraf/session/pg";
import { inlineMenuArray } from "./constants.js";
import {
  addNewWallet,
  checkWalletExists,
  sendUserWallets,
  deleteWallet,
  editWalletName,
  getWalletAddressById,
  getWalletNameById,
} from "./db.js";
import { getUSDTBalance, fetchAndFormatTransactions } from "./tron.js";
import { handleWalletMenu, isValidWalletAddress } from "./wallets.js";

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
        const transactions = await fetchAndFormatTransactions(walletAddress, walletName);
        const textBalanceMessage = await getUSDTBalance(walletAddress);

        await ctx.reply(transactions, { parse_mode: "Markdown" });
        await ctx.reply(textBalanceMessage, { parse_mode: "Markdown" });
      } catch (error) {
        console.error(`Ошибка при показе всех транзакций: ${error.message}`);
      }
      return;
    }

    switch (ctxData) {
      //inline keyboard menu
      case "wallets":
        handleWalletMenu(ctx);
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
        break;

      case "return":
        handleStartMenu(ctx);
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
    const walletAddress = ctx.update.message.text;

    if (isValidWalletAddress(walletAddress)) {
      const isWalletExists = await checkWalletExists(
        userId,
        username,
        walletAddress
      );

      if (isWalletExists) {
        await ctx.reply(
          "Этот адрес кошелька уже добавлен для данного пользователя."
        );
      } else {
        const textBalanceMessage = await getUSDTBalance(walletAddress);
        await ctx.reply(textBalanceMessage, { parse_mode: "Markdown" });

        ctx.session.walletAddress = walletAddress;
        ctx.session.awaitingWalletAddress = false;
        ctx.session.awaitingWalletName = true;
        await ctx.reply("Как назвать этот кошелек?");
      }
    } else {
      await ctx.reply("Адрес не подходит, попробуйте еще раз.");
    }
  } else if (ctx.session.awaitingWalletName) {
    const walletName = ctx.update.message.text;
    const walletAddress = ctx.session.walletAddress;

    await addNewWallet(userId, username, walletAddress, walletName);

    await ctx.reply("Адрес кошелька успешно добавлен :)");

    ctx.session.awaitingWalletName = false;
    delete ctx.session.walletAddress;
  } else if (ctx.session.awaitingNewName) {
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
  } else {
    await ctx.reply(
      "Нужно выбрать команду из меню. Я не отвечаю на сообщения в чате 🦾🤖"
    );
  }
});

bot.launch();
