import mysql from "mysql2/promise";
import { RowDataPacket } from "mysql2";
import { Wallet } from "../types";
export const fetchWalletDetails = async (): Promise<Wallet[]> => {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "user",
    password: "user_password",
    database: "wallet_db",
  });

  // Use RowDataPacket[] for result typing
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT * FROM wallets"
  );
  await connection.end();

  // Map rows to Wallet type
  return rows.map((row) => ({
    API_KEY: row.api_key,
    API_SECRET: row.api_secret,
    balance: row.balance,
    leverage: row.leverage,
  }));
};