import { inlineHistoryArray } from "./constants.js";

export const handleHistoryMenu = (ctx) => {
    const startTextMessage = `Сколько последних транзакций показывать?`;
    const startCaptchaMessage = {
      reply_markup: {
        inline_keyboard: inlineHistoryArray,
      },
    };
  
    ctx.reply(startTextMessage, startCaptchaMessage);
  };