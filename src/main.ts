import "reflect-metadata";
import "./config.js";
import { Telegraf, session } from "telegraf";
import { Postgres } from "@telegraf/session/pg";
import { AppDataSource, getSessionPgPool } from "./data-source.js";
import { ensurePostgresDatabaseExists } from "./ensure-database.js";
import { ensureWalletsTable } from "./ensure-schema.js";
import { inlineMenuArray, MAX_TRANSACTIONS_PER_MESSAGE } from "./constants.js";
import { handleHistoryMenu, showTransactions } from "./history.js";
import {
  addNewWallet,
  checkWalletExists,
  sendUserWallets,
  deleteWallet,
  editWalletName,
  getAllSubscriptions,
  removeSubscription,
  getWalletAddressById,
  getWalletNameById,
} from "./db.js";
import {
  getUSDTBalance,
  formatTransactions,
  fetchNewTransactions,
} from "./tron.js";
import {
  handleWalletMenu,
  isValidWalletAddress,
  extractWalletAddressFromMessage,
} from "./wallets.js";
import type { BotSession } from "./types/session.js";
import type { SessionContext } from "./types/context.js";

function getTelegramToken(): string {
  const t = process.env.TELEGRAM_TOKEN;
  if (!t) {
    throw new Error("Задайте TELEGRAM_TOKEN в окружении или .env");
  }
  return t;
}

const telegramToken = getTelegramToken();

function isForbiddenTelegramError(e: unknown): boolean {
  const err = e as { code?: number; response?: { error_code?: number } };
  return err.code === 403 || err.response?.error_code === 403;
}

async function bootstrap(): Promise<void> {
  await ensurePostgresDatabaseExists();
  await AppDataSource.initialize();
  await ensureWalletsTable(AppDataSource);
  console.log("База данных подключена (TypeORM)");

  const pool = getSessionPgPool();
  const store = Postgres<BotSession>({ pool });

  const bot = new Telegraf<SessionContext>(telegramToken, {
    handlerTimeout: Infinity,
  });

  bot.use(
    session({
      store,
      defaultSession: (): BotSession => ({ count: 0 }),
    })
  );

  function handleStartMenu(ctx: SessionContext): void {
    const startTextMessage = `Вы можете воспользоваться следующими командами:`;
    const startCaptchaMessage = {
      reply_markup: {
        inline_keyboard: inlineMenuArray,
      },
    };

    void ctx.reply(startTextMessage, startCaptchaMessage);
  }

  bot.start((ctx) => {
    console.log("Команда /start была вызвана");
    handleStartMenu(ctx);
  });

  bot.command("menu", (ctx) => {
    console.log("Команда /menu была вызвана");
    ctx.session.awaitingWalletAddress = false;
    ctx.session.awaitingWalletName = false;
    ctx.session.awaitingNewName = false;
    handleStartMenu(ctx);
  });

  bot.on("callback_query", async (ctx) => {
    try {
      const cq = ctx.callbackQuery;
      if (!cq || !("data" in cq) || typeof cq.data !== "string") {
        return;
      }
      const ctxData = cq.data;

      const textWalletsMessage = "Введите адрес вашего USDT кошелька 💸";

      const deleteMatch = ctxData.match(/^delete_(.+)$/);
      if (deleteMatch) {
        const walletId = deleteMatch[1];
        if (!walletId) return;
        try {
          const walletAddress = await deleteWallet(walletId);
          await ctx.reply(`Кошелек ${walletAddress ?? ""} удален.`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`Ошибка при удалении кошелька: ${msg}`);
        }
        return;
      }

      const editMatch = ctxData.match(/^edit_(.+)$/);
      if (editMatch) {
        const walletId = editMatch[1];
        if (!walletId) return;
        ctx.session.walletIdForEdit = walletId;
        ctx.session.awaitingNewName = true;
        await ctx.reply("Как переименовать этот кошелек?");
        return;
      }

      const showMatch = ctxData.match(/^show_(.+)$/);
      if (showMatch) {
        const walletId = showMatch[1];
        if (!walletId) return;
        try {
          const walletAddress = await getWalletAddressById(walletId);
          const walletName = await getWalletNameById(walletId);
          await showTransactions(walletAddress, walletName, ctx, false);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`Ошибка при показе всех транзакций: ${msg}`);
        }
        return;
      }

      switch (ctxData) {
        case "wallets":
          await handleWalletMenu(ctx);
          ctx.session.awaitingWalletAddress = false;
          ctx.session.awaitingWalletName = false;
          ctx.session.awaitingNewName = false;
          break;

        case "history":
          handleHistoryMenu(ctx);
          break;

        case "transactions":
          await sendUserWallets(ctx, "transaction");
          break;

        case "addNew":
          await ctx.reply(textWalletsMessage);
          ctx.session.awaitingWalletAddress = true;
          break;

        case "allWallets":
          await sendUserWallets(ctx, "wallet");
          ctx.session.awaitingWalletAddress = false;
          ctx.session.awaitingWalletName = false;
          ctx.session.awaitingNewName = false;
          break;

        case "more": {
          const walletAddress = ctx.session.walletAddress;
          const walletName = ctx.session.walletName;
          await showTransactions(
            walletAddress ?? null,
            walletName ?? null,
            ctx,
            true
          );
          break;
        }

        case "return":
          handleStartMenu(ctx);
          break;

        case "20":
        case "5":
        case "10":
          ctx.session.filter = ctxData;
          await ctx.reply(`Фильтр на *${ctxData}* транзакций установлен.`, {
            parse_mode: "Markdown",
          });
          await sendUserWallets(ctx, "transaction");
          break;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Ошибка: ${msg}`, error);
    }
  });

  bot.on("message", async (ctx) => {
    try {
      const msg = ctx.message;
      console.log("Получено сообщение: ", msg);
      const userId = msg.from.id;
      const username = msg.from.username;

      if (!("text" in msg) || typeof msg.text !== "string") {
        await ctx.reply("Пожалуйста, отправьте текстовое сообщение.");
        return;
      }

      if (msg.text === "/start") {
        handleStartMenu(ctx);
        return;
      }

      if (ctx.session.awaitingWalletAddress) {
        const walletAddress = extractWalletAddressFromMessage(msg.text);

        if (!walletAddress || !isValidWalletAddress(walletAddress)) {
          await ctx.reply("Адрес не подходит, попробуйте еще раз.");
          return;
        }

        const isWalletExists = await checkWalletExists(
          userId,
          username,
          walletAddress
        );
        if (isWalletExists) {
          await ctx.reply(
            "Этот адрес кошелька уже добавлен для данного пользователя."
          );
          return;
        }

        const textBalanceMessage = await getUSDTBalance(walletAddress);
        await ctx.reply(textBalanceMessage, { parse_mode: "Markdown" });

        ctx.session.walletAddress = walletAddress;
        ctx.session.awaitingWalletAddress = false;
        ctx.session.awaitingWalletName = true;
        await ctx.reply("Как назвать этот кошелек?");
        return;
      }

      if (ctx.session.awaitingWalletName) {
        const walletName = msg.text;
        const walletAddress = ctx.session.walletAddress;

        if (!walletAddress) {
          await ctx.reply("Ошибка: не найден адрес кошелька в сессии.");
          return;
        }

        await addNewWallet(userId, username, walletAddress, walletName, ctx);

        ctx.session.awaitingWalletName = false;
        delete ctx.session.walletAddress;
        return;
      }

      if (ctx.session.awaitingNewName) {
        const newName = msg.text;
        const walletId = ctx.session.walletIdForEdit;

        if (!walletId) {
          await ctx.reply("Ошибка: не найден ID кошелька для редактирования.");
          return;
        }

        try {
          await editWalletName(walletId, newName);
          await ctx.reply(`Имя кошелька успешно изменено на: ${newName}`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`Ошибка при редактировании имени кошелька: ${msg}`);
          await ctx.reply(
            "Произошла ошибка при попытке изменить имя кошелька. Пожалуйста, попробуйте снова."
          );
        }

        ctx.session.awaitingNewName = false;
        delete ctx.session.walletIdForEdit;
        return;
      }

      await ctx.reply(
        "Нужно выбрать команду из меню. Я не отвечаю на сообщения в чате 🦾🤖"
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Произошла ошибка при обработке сообщения:", msg);
      await ctx.reply(
        "Произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте снова."
      );
    }
  });

  async function sendMessageToAllUsers(): Promise<void> {
    const subscriptions = await getAllSubscriptions();
    for (const subscription of subscriptions) {
      console.log("DO TRANS");
      try {
        const walletAddress = subscription.walletAddress;
        const lastKnownTransactionId = subscription.lastKnownTransactionId;
        const newTransactions = await fetchNewTransactions(
          walletAddress,
          lastKnownTransactionId
        );

        if (newTransactions.length > 0) {
          for (
            let i = 0;
            i < newTransactions.length;
            i += MAX_TRANSACTIONS_PER_MESSAGE
          ) {
            const transactionsChunk = newTransactions.slice(
              i,
              i + MAX_TRANSACTIONS_PER_MESSAGE
            );
            const message = formatTransactions(
              transactionsChunk,
              subscription.walletName,
              subscription.walletAddress
            );
            await bot.telegram.sendMessage(subscription.chatId, message, {
              parse_mode: "Markdown",
            });
            const textBalanceMessage = await getUSDTBalance(walletAddress);
            await bot.telegram.sendMessage(
              subscription.chatId,
              textBalanceMessage,
              {
                parse_mode: "Markdown",
              }
            );
          }
        }
      } catch (e) {
        console.error(
          `Ошибка при отправке сообщения пользователю с ID ${subscription.chatId}:`,
          e
        );

        if (isForbiddenTelegramError(e)) {
          await removeSubscription(subscription.chatId);
          console.log(
            `Подписка для chatId: ${subscription.chatId} удалена из-за блокировки бота.`
          );
        }
      }
    }
  }

  void sendMessageToAllUsers();
  setInterval(() => {
    void sendMessageToAllUsers();
  }, 30_000);

  await bot.launch();
}

bootstrap().catch((err: unknown) => {
  console.error("Не удалось запустить бота:", err);
  process.exit(1);
});
