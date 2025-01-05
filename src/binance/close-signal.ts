import { USDMClient } from "binance";
import { CloseSignal, Wallet } from "../../types";

export async function handleCloseSignal(signal: CloseSignal, wallet: Wallet): Promise<void> {
  const { pair } = signal;
  const { API_KEY, API_SECRET } = wallet;

  try {
    // Initialize client
    const client = new USDMClient({
      api_key: API_KEY,
      api_secret: API_SECRET,
      beautifyResponses: true,
    });

    console.log(`Handling close signal for pair: ${pair}`);

    // Step 1: Get all open positions for the symbol
    const position = await client.getPositionsV3({symbol: pair})

    if (!position) {
      console.log(`No open positions found for ${pair}.`);
      return;
    }

    const side = parseFloat(String(position[0].positionAmt)) > 0 ? "SELL" : "BUY";
    const quantity = Math.abs(parseFloat(String(position[0].positionAmt)))

    console.log(`Closing position for ${pair}: ${quantity} ${side}`);

    // Step 2: Close the position by placing an opposite market order
    const marketOrder = await client.submitNewOrder({
      symbol: pair,
      side,
      type: "MARKET",
      quantity: quantity,
    });

    console.log(`Market order placed to close position: ${marketOrder.orderId}`);

    // Step 3: Cancel all open orders for the symbol
    const cancelOrders = await client.cancelAllOpenOrders({ symbol: pair });
    console.log(`Cancelled ${JSON.stringify(cancelOrders, null, 2)} open orders for ${pair}.`);

  } catch (error) {
    console.error(`Error handling close signal for ${pair}:`, error);
  }

}