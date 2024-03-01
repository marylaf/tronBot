import { Telegraf } from "telegraf";
import { config } from "dotenv";
import { inlineMenuArray, inlineWalletArray, inlineHistoryArray } from "./constants.js";

config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
  handlerTimeout: Infinity,
});

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
bot.command("menu", (ctx) => handleStartMenu(ctx));

bot.on("callback_query", async (ctx) => {
  try {
    const ctxData = ctx.update.callback_query.data;
    switch (ctxData) {
      case "wallets":
        handleWalletMenu(ctx);
        break;

      case "history":
        handleHistoryMenu(ctx);
        break;

      case "transactions":
        console.log("Четыре");
        break;

        case "return":
        handleStartMenu(ctx);
        console.log("Возврат");
        break;
    }
  } catch (error) {
    console.error(`Ошибка: ${error.message}`, error);
  }
});

bot.launch();
