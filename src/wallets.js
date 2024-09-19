import { inlineWalletArray } from "./constants.js";

// function for opening wallet's menu
export function extractWalletAddressFromMessage(message) {
  const re = /^.*(T[a-zA-Z0-9]{33}).*$/;
  try {
    const match = message.match(re);
    if (!match) {
      throw new Error("Адрес кошелька не найден в сообщении.");
    }
    return match[1];
  } catch (e) {
    console.error("Ошибка при извлечении адреса кошелька:", e.message);
    return null;
  }
}

export function isValidWalletAddress(address) {
  if (typeof address !== "string") {
    throw new Error("Адрес должен быть строкой.");
  }

  if (address.length !== 34) {
    throw new Error("Адрес должен содержать 34 символа.");
  }

  const re = /^T[a-zA-Z0-9]{33}$/;

  if (!re.test(address)) {
    throw new Error(
      "Адрес должен начинаться с 'T' и содержать только буквы и цифры."
    );
  }

  return true;
}
