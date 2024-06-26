import { inlineWalletArray } from "./constants.js";

// function for opening wallet's menu
export const handleWalletMenu = (ctx) => {
    const startTextMessage = `Что будем делать с кошельками?`;
    const startCaptchaMessage = {
      reply_markup: {
        inline_keyboard: inlineWalletArray,
      },
    };
  
    ctx.reply(startTextMessage, startCaptchaMessage);
  };

export function extractWalletAddressFromMessage(message) {
  const re = /^.*(T[a-zA-Z0-9]{33}).*$/;
  try {
    return message.match(re)[1];
  } catch (e) {
    return null;
  }
}

 export function isValidWalletAddress(address) {
    if (typeof address !== "string") {
      return false;
    }
    const re = /^T[a-zA-Z0-9]{33}$/;
    return re.test(address);
  }
