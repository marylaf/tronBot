import type { Context } from "telegraf";
import { inlineWalletArray } from "./constants.js";

/** Извлекает первый адрес Tron (T + 33 символа) из текста. */
export function extractWalletAddressFromMessage(
  message: string
): string | null {
  const re = /^.*(T[a-zA-Z0-9]{33}).*$/;
  const match = message.match(re);
  if (!match) {
    console.error("Адрес кошелька не найден в сообщении.");
    return null;
  }
  return match[1] ?? null;
}

export function isValidWalletAddress(address: string): boolean {
  if (address.length !== 34) {
    return false;
  }
  const re = /^T[a-zA-Z0-9]{33}$/;
  return re.test(address);
}

export async function handleWalletMenu(ctx: Context): Promise<void> {
  const startTextMessage = `Что будем делать с кошельками?`;
  const startCaptchaMessage = {
    reply_markup: {
      inline_keyboard: inlineWalletArray,
    },
  };

  try {
    await ctx.reply(startTextMessage, startCaptchaMessage);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Ошибка при отправке сообщения:", msg);
    await ctx.reply(
      "Произошла ошибка при открытии меню кошельков. Пожалуйста, попробуйте снова."
    );
  }
}
