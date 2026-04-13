/** Состояние сессии бота (Telegraf + @telegraf/session/pg). */
export interface BotSession {
  count: number;
  awaitingWalletAddress?: boolean;
  awaitingWalletName?: boolean;
  awaitingNewName?: boolean;
  walletAddress?: string;
  walletName?: string;
  walletIdForEdit?: string;
  filter?: string | number;
  pagination?: { fingerprint?: string };
}
