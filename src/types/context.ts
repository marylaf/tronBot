import type { Context } from "telegraf";
import type { BotSession } from "./session.js";

/** Контекст с персистентной сессией. */
export type SessionContext = Context & { session: BotSession };
