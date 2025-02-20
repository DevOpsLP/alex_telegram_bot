import mysql from "mysql2/promise";
import { RowDataPacket } from "mysql2";
import { Wallet } from "../types";
export const fetchWalletDetails = async (): Promise<Wallet[]> => {
  // const connection = await mysql.createConnection({
  //   host: "localhost",
  //   user: "user",
  //   password: "user_password",
  //   database: "wallet_db",
  // });

  // // Use RowDataPacket[] for result typing
  // const [rows] = await connection.execute<RowDataPacket[]>(
  //   "SELECT * FROM wallets"
  // );
  // await connection.end();

  // // Map rows to Wallet type
  // return rows.map((row) => ({
  //   API_KEY: row.api_key,
  //   API_SECRET: row.api_secret,
  //   balance: row.balance,
  //   leverage: row.leverage,
  // }));

  /**
   * Testing only
   */
  const binanceApiKey = process.env.BINANCE_API_KEY;
  const binanceApiSecret = process.env.BINANCE_API_SECRET;

  if (!binanceApiKey || !binanceApiSecret) {
    throw new Error("Missing Binance API key or secret in .env");
  }

  return [
    {
      API_KEY: binanceApiKey,
      API_SECRET: binanceApiSecret,
      balance: 8,
      leverage: 20,
    },
  ];
  
};