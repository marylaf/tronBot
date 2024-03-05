import { Telegraf, session } from "telegraf";
import { config } from "dotenv";
import { Postgres } from "@telegraf/session/pg";
import { inlineMenuArray } from "./constants.js";
import { addNewWallet, checkWalletExists } from "./db.js";
import { getUSDTBalance } from "./tron.js";
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
    switch (ctxData) {
      //inline keyboard menu
      case "wallets":
        handleWalletMenu(ctx);
        break;

      case "history":
        handleHistoryMenu(ctx);
        break;

      case "transactions":
        console.log("Четыре");
        break;

      //inline keyboard wallets
      case "addNew":
        ctx.reply(textWalletsMessage);
        ctx.session.awaitingWalletAddress = true;
        break;

      case "allWallets":
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

      const isWalletExists = await checkWalletExists(userId, username, walletAddress);

      if (isWalletExists) {
        await ctx.reply("Этот адрес кошелька уже добавлен для данного пользователя.");
      } else {
        const textBalanceMessage = await getUSDTBalance(walletAddress);
        await ctx.reply(textBalanceMessage);

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
  } else {
    await ctx.reply(
      "Нужно выбрать команду из меню. Я не отвечаю на сообщения в чате 🦾🤖"
    );
  }
});

bot.launch();
