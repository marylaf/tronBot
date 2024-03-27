export const inlineMenuArray = [
  [{ text: "Кошельки", callback_data: "wallets" }],
  [
    { text: "История", callback_data: "history" },
    { text: "Транзакции", callback_data: "transactions" },
  ],
];

export const inlineWalletArray = [
  [{ text: "Все кошельки", callback_data: "allWallets" }],
  [{ text: "Добавить новый", callback_data: "addNew" }],
  [{ text: "В меню", callback_data: "return" }],
];

export const inlineHistoryArray = [
  [{ text: "5 шт", callback_data: "5" }],
  [{ text: "10 шт", callback_data: "10" }],
  [{ text: "20 шт", callback_data: "20" }],
];

export const inlineTransArray = [
  [{ text: "Да", callback_data: "more" }],
];

export const usdtContractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export const MAX_TRANSACTIONS_PER_MESSAGE = 12;
