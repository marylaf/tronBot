import { Telegraf } from "telegraf";
import { config } from "dotenv";

config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
  handlerTimeout: Infinity,
});

// funсtion menu
const handleStartMenu = (ctx) => {
  const startTextMessage = `Вы можете воспользоваться следующими командами:`;
  const startCaptchaMessage = {
    reply_markup: {
      inline_keyboard: inlineArray,
    },
  };

  ctx.reply(startTextMessage, startCaptchaMessage);
};

const inlineArray = [
  [
    { text: "Кошельки", callback_data: "wallets" },
    { text: "Фильтры", callback_data: "filters" },
  ],
  [
    { text: "История", callback_data: "history" },
    { text: "Транзакции", callback_data: "transactions" },
  ],
];
bot.start((ctx) => handleStartMenu(ctx));
bot.command("menu", (ctx) => handleStartMenu(ctx));

bot.launch();
