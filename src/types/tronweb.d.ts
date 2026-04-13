declare module "tronweb" {
  /** Минимальная типизация для используемых вызовов TronWeb. */
  export default class TronWeb {
    constructor(opts: Record<string, unknown>);
    setAddress(address: string): void;
    toBigNumber(value: string | number): { toNumber(): number };
    contract(): {
      at(address: string): Promise<{
        balanceOf(addr: string): { call(): Promise<unknown> };
      }>;
    };
  }
}
