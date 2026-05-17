import axios, { type AxiosError } from "axios";

const TRONGRID_KEY_ENV_VARS = [
  "TRONGRID_API_KEY",
  "TRONGRID_API_KEY_SECOND",
  "TRONGRID_API_KEY_THIRD",
] as const;

const apiKeys = TRONGRID_KEY_ENV_VARS.map((name) => process.env[name]?.trim()).filter(
  (key): key is string => Boolean(key)
);

let currentKeyIndex = 0;

type HeadersSyncFn = () => void;
let syncHeaders: HeadersSyncFn | null = null;

export function registerTronGridHeadersSync(fn: HeadersSyncFn): void {
  syncHeaders = fn;
}

export function getTronGridKeyCount(): number {
  return Math.max(apiKeys.length, 1);
}

export function getTronGridHeaders(): Record<string, string> | undefined {
  const key = apiKeys[currentKeyIndex];
  return key ? { "TRON-PRO-API-KEY": key } : undefined;
}

export function advanceToNextTronGridKey(): boolean {
  if (currentKeyIndex >= apiKeys.length - 1) {
    return false;
  }
  currentKeyIndex += 1;
  syncHeaders?.();
  return true;
}

function messageIndicatesRateLimit(message: string): boolean {
  return /rate.?limit|too many requests|quota|throttl/i.test(message);
}

export function isRateLimitError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 429) {
      return true;
    }

    if (status === 403 || status === 503) {
      const body = stringifyResponseData(error);
      return messageIndicatesRateLimit(body);
    }

    return false;
  }

  if (error instanceof Error) {
    return messageIndicatesRateLimit(error.message);
  }

  return false;
}

function stringifyResponseData(error: AxiosError): string {
  const data = error.response?.data;
  if (typeof data === "string") {
    return data;
  }
  try {
    return JSON.stringify(data ?? "");
  } catch {
    return "";
  }
}

export async function withTronGridRetry<T>(fn: () => Promise<T>): Promise<T> {
  const attempts = getTronGridKeyCount();
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) {
        throw error;
      }

      const keyNumber = currentKeyIndex + 1;
      const switched = advanceToNextTronGridKey();
      if (!switched) {
        console.error(
          `TronGrid rate limit: исчерпаны все API ключи (последний — #${keyNumber})`
        );
        throw error;
      }

      console.warn(
        `TronGrid rate limit на ключе #${keyNumber}, переключение на ключ #${currentKeyIndex + 1}`
      );
    }
  }

  throw lastError;
}
