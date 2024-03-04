import { Telegraf, session } from "telegraf";
import { config } from "dotenv";
import { Postgres } from "@telegraf/session/pg";
import {
  inlineMenuArray,
  inlineWalletArray,
  inlineHistoryArray,
} from "./constants.js";
import { addNewWallet } from './db.js';

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

// function for opening wallet's menu
const handleWalletMenu = (ctx) => {
  const startTextMessage = `Что будем делать с кошельками?`;
  const startCaptchaMessage = {
    reply_markup: {
      inline_keyboard: inlineWalletArray,
    },
  };

  ctx.reply(startTextMessage, startCaptchaMessage);
};

const handleHistoryMenu = (ctx) => {
  const startTextMessage = `Сколько последних транзакций показывать?`;
  const startCaptchaMessage = {
    reply_markup: {
      inline_keyboard: inlineHistoryArray,
    },
  };

  ctx.reply(startTextMessage, startCaptchaMessage);
};

bot.start((ctx) => handleStartMenu(ctx));
bot.command("menu", (ctx) => {
  ctx.session.awaitingWalletAddress = false;
  handleStartMenu(ctx);
})

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

function isValidWalletAddress(address) {
  if (typeof address !== 'string') {
    return false;
  }
  const re = /^T[a-zA-Z0-9]{33}$/;
  return re.test(address);
}

bot.on("message", async (ctx) => {
  if (ctx.session.awaitingWalletAddress) {
    const walletAddress = ctx.update.message.text;
    const username = ctx.update.message.from.username;
    const userId = ctx.update.message.from.id;

    if (isValidWalletAddress(walletAddress)) {
      try {
        await addNewWallet( userId, username, walletAddress);
        await ctx.reply("Адрес кошелька успешно добавлен :)");
        ctx.session.awaitingWalletAddress = false;
      } catch (error) {
        await ctx.reply(error.message);
      }
    } else {
      await ctx.reply("Адрес не подходит, попробуйте еще раз");
    }
  } else {
    await ctx.reply("Нужно выбрать команду из меню. Я не отвечаю на сообщения в чате 🦾🤖");
  }
});

bot.launch();