export interface TradeSignal {
  type: "TRADE_SIGNAL";
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry: number[];
  targets: number[];
  stopLoss: number;
}

// Define the CloseSignal type separately
export type CloseSignal = { 
  type?: "CLOSE_SIGNAL"; 
  pair: string; 
  direction: "LONG" | "SHORT"; 
};

export type ParsedMessage = TradeSignal | CloseSignal;


export interface Wallet {
  API_KEY: string;
  API_SECRET: string;
  balance: number; // in USDT
  leverage: number; // 10, 20, etc.
}

export interface PlacedOrder {
  clientOrderId: string;
  origPrice: number;
}

export interface BracketData {
  brackets: {
    initialLeverage: number;
  }[];
}