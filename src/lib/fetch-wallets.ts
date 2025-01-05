import { Wallet } from "../../types";

export const fetchWalletDetails = async (): Promise<Wallet[]> => {
    return [
      {
        API_KEY: process.env.BINANCE_API_KEY || '',
        API_SECRET: process.env.BINANCE_API_SECRET || '',
        balance: 5,
        leverage: 30
      },
    ];
  }
  