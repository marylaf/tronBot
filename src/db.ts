import type { Context } from "telegraf";
import { AppDataSource } from "./data-source.js";
import { Wallet } from "./entity/Wallet.js";
import { withTronGridRetry } from "./trongrid-keys.js";
import { getUSDTBalance, tron } from "./tron.js";

export type WalletRow = Wallet;

function parseWalletId(walletId: string): number | null {
  const id = Number.parseInt(walletId, 10);
  return Number.isFinite(id) ? id : null;
}

export async function addNewWallet(
  userId: number,
  username: string | undefined,
  walletAddress: string,
  walletName: string,
  ctx: Context
): Promise<Wallet | undefined> {
  console.log(
    `🔹 [addNewWallet] Start for userId=${userId}, wallet=${walletAddress}, name=${walletName}`
  );

  try {
    return await AppDataSource.manager.transaction(async (manager) => {
      console.log(`🟢 [${userId}] BEGIN transaction`);

      const url = `/v1/accounts/${walletAddress}/transactions/trc20`;
      console.log(`🌐 [${userId}] Fetching transactions from TronGrid: ${url}?limit=20`);

      const response = await withTronGridRetry(() =>
        tron.get<{
          data?: Array<{
            transaction_id?: string;
            token_info?: { symbol?: string };
          }>;
        }>(url, { params: { limit: 20 } })
      );
      const transactions = response.data.data ?? [];
      console.log(
        `📦 [${userId}] Total transactions fetched: ${transactions.length}`
      );

      const usdtTransactions = transactions.filter(
        (tx) => tx.token_info?.symbol === "USDT"
      );
      console.log(
        `💰 [${userId}] USDT transactions found: ${usdtTransactions.length}`
      );

      let lastKnownTransactionId = "0";
      if (usdtTransactions.length > 0) {
        const first = usdtTransactions[0];
        lastKnownTransactionId = first.transaction_id ?? "0";
        console.log(
          `🔑 [${userId}] Last known transaction ID: ${lastKnownTransactionId}`
        );
      } else {
        console.log(
          `⚠️ [${userId}] No USDT transactions found, using default ID 0`
        );
      }

      const repo = manager.getRepository(Wallet);
      const entity = repo.create({
        userId: String(userId),
        username: (username ?? "").slice(0, 50),
        walletAddress: walletAddress.slice(0, 255),
        walletName: walletName.slice(0, 255),
        lastKnownTransactionId,
      });
      const saved = await repo.save(entity);

      console.log(
        `✅ [${userId}] Wallet inserted successfully — ID: ${saved.id}`
      );
      await ctx.reply("✅ Адрес кошелька успешно добавлен :)");
      return saved;
    });
  } catch (error: unknown) {
    console.error(`❌ [${userId}] Error adding wallet:`, error);
    return undefined;
  } finally {
    console.log(`🔚 [${userId}] transaction finished`);
  }
}

export async function checkWalletExists(
  userId: number,
  username: string | undefined,
  walletAddress: string
): Promise<boolean> {
  try {
    const repo = AppDataSource.getRepository(Wallet);
    const count = await repo
      .createQueryBuilder("w")
      .where("w.userId = :userId", { userId: String(userId) })
      .andWhere("w.walletAddress = :walletAddress", { walletAddress })
      .andWhere("w.username = :username", {
        username: (username ?? "").slice(0, 50),
      })
      .getCount();
    return count > 0;
  } catch (error) {
    console.log("Error checking wallet existence:", error);
    return false;
  }
}

export async function getUserWallets(userId: number): Promise<Wallet[]> {
  try {
    return await AppDataSource.getRepository(Wallet).find({
      where: { userId: String(userId) },
      order: { id: "ASC" },
    });
  } catch (error) {
    console.error("Error retrieving user wallets:", error);
    return [];
  }
}

export async function sendUserWallets(
  ctx: Context,
  context: "transaction" | "wallet"
): Promise<void> {
  const cq = ctx.callbackQuery;
  if (!cq || !("from" in cq) || !cq.from) {
    return;
  }
  const userId = cq.from.id;
  const wallets = await getUserWallets(userId);

  if (wallets.length === 0) {
    await ctx.reply("На данный момент в системе нет кошельков.");
    return;
  }

  await ctx.reply("На данный момент в системе есть следующие кошельки:");

  for (const wallet of wallets) {
    const balance = await getUSDTBalance(wallet.walletAddress);
    const messageText =
      `*${wallet.walletName}*\n\n` +
      `Адрес - [${wallet.walletAddress}](https://tronscan.org/#/address/${wallet.walletAddress})\n\n` +
      balance;

    const buttons =
      context === "transaction"
        ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Показать", callback_data: `show_${wallet.id}` }],
              ],
            },
          }
        : {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Редактировать",
                    callback_data: `edit_${wallet.id}`,
                  },
                ],
                [{ text: "Удалить", callback_data: `delete_${wallet.id}` }],
              ],
            },
          };

    await ctx.reply(messageText, {
      reply_markup: buttons.reply_markup,
      link_preview_options: { is_disabled: true },
      parse_mode: "Markdown",
    });
  }
}

export async function deleteWallet(walletId: string): Promise<string | null> {
  const id = parseWalletId(walletId);
  if (id === null) {
    return null;
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const repo = queryRunner.manager.getRepository(Wallet);
    const found = await repo.findOne({ where: { id } });
    if (!found) {
      console.log(`Кошелёк с id ${walletId} не найден.`);
      await queryRunner.rollbackTransaction();
      return null;
    }
    await repo.delete({ id });
    await queryRunner.commitTransaction();
    return found.walletAddress;
  } catch (error) {
    console.log("Ошибка при удалении кошелька:", error);
    await queryRunner.rollbackTransaction();
    return null;
  } finally {
    await queryRunner.release();
  }
}

export async function editWalletName(
  walletId: string,
  newName: string
): Promise<void> {
  const id = parseWalletId(walletId);
  if (id === null) {
    throw new Error("Некорректный id кошелька");
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.manager.getRepository(Wallet).update(
      { id },
      { walletName: newName }
    );
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export async function getWalletAddressById(
  walletId: string
): Promise<string | null> {
  const id = parseWalletId(walletId);
  if (id === null) {
    return null;
  }

  try {
    const row = await AppDataSource.getRepository(Wallet).findOne({
      where: { id },
    });
    if (row) {
      return row.walletAddress;
    }
    console.log("Кошелек не найден");
    return null;
  } catch (error) {
    console.error("Ошибка при извлечении адреса кошелька:", error);
    return null;
  }
}

export async function getWalletNameById(
  walletId: string
): Promise<string | null> {
  const id = parseWalletId(walletId);
  if (id === null) {
    return null;
  }

  try {
    const row = await AppDataSource.getRepository(Wallet).findOne({
      where: { id },
    });
    if (row) {
      return row.walletName;
    }
    console.log("Имя не найдено");
    return null;
  } catch (error) {
    console.error("Ошибка при извлечении имени кошелька:", error);
    return null;
  }
}

export interface SubscriptionRow {
  chatId: string;
  walletAddress: string;
  walletName: string;
  lastKnownTransactionId: string;
}

export async function getAllSubscriptions(): Promise<SubscriptionRow[]> {
  try {
    const rows = await AppDataSource.getRepository(Wallet).find();
    return rows.map((w) => ({
      chatId: w.userId,
      walletAddress: w.walletAddress,
      walletName: w.walletName,
      lastKnownTransactionId: w.lastKnownTransactionId ?? "0",
    }));
  } catch (error) {
    console.error("Ошибка при получении подписок:", error);
    throw error;
  }
}

export async function removeSubscription(chatId: string): Promise<void> {
  try {
    await AppDataSource.getRepository(Wallet).delete({ userId: chatId });
  } catch (error) {
    console.log("Error removing subscription:", error);
  }
}
