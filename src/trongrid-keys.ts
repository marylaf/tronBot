const apiKey = process.env.TRONGRID_API_KEY?.trim() || undefined;

export function registerTronGridHeadersSync(_fn: () => void): void {}

export function getTronGridHeaders(): Record<string, string> | undefined {
  return apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined;
}

export async function withTronGridRetry<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}
