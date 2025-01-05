import { USDMClient, WebsocketClient } from "binance";
import { TradeSignal, Wallet } from "../../types";

export async function monitorWalletAndCancelOnFilled(
  wallet: Wallet,
  tradeSignal: TradeSignal
): Promise<void> {
  const { API_KEY, API_SECRET } = wallet;

  try {
    // Initialize Binance client for futures
    const client = new USDMClient({
      api_key: API_KEY,
      api_secret: API_SECRET,
      beautifyResponses: true,
    });

    // Initialize WebSocket client
    const wsClient = new WebsocketClient({
      api_key: API_KEY,
      api_secret: API_SECRET,
      beautify: true,
    });

    // Subscribe to user data
    wsClient.subscribeUsdFuturesUserDataStream();

    wsClient.on("formattedMessage", async (data: any) => {
      console.log("Received WebSocket message:", data);

      if (
        data.eventType === "ORDER_TRADE_UPDATE" && // Check if it's an ORDER_TRADE_UPDATE event
        data.order.executionType === "TRADE" && // Check if Execution Type is TRADE
        data.order.orderStatus === "FILLED" // Check if Order Status is FILLED
      ) {
        const order = data.order; // Extract order details
        const { symbol, originalOrderType, orderId } = order;

        // Handle STOP_MARKET or TRAILING_STOP_MARKET being filled
        if (originalOrderType === "STOP_MARKET" || originalOrderType === "TRAILING_STOP_MARKET") {
          console.log(`${originalOrderType} order FILLED for ${symbol}. Cancelling all open orders.`);
        } else {
          console.log(`Ignoring order type: ${originalOrderType}`);
          return; // Ignore other order types
        }

        // Fetch all open orders for the symbol
        try {
          const openOrders = await client.getAllOpenOrders({ symbol });

          if (openOrders.length > 0) {
            console.log(`Cancelling ${openOrders.length} open orders for ${symbol}...`);
            for (const openOrder of openOrders) {
              try {
                await client.cancelOrder({ symbol, orderId: openOrder.orderId });
                console.log(`Cancelled order ID: ${openOrder.orderId}`);
              } catch (cancelError) {
                console.error(`Error cancelling order ID ${openOrder.orderId}:`, cancelError.message || cancelError);
              }
            }
          } else {
            console.log(`No open orders to cancel for ${symbol}.`);
          }

          console.log(`All necessary actions completed for ${symbol}.`);
          // Close the WebSocket after actions are complete
          wsClient.close(`All necessary actions completed for ${symbol}.`);
        } catch (error) {
          console.error(`Error fetching or cancelling orders for ${symbol}:`, error.message || error);
        }
      }
    });

    wsClient.on("error", (error) => {
      console.error(`WebSocket error for wallet ${API_KEY}:`, error.error || error);
    });

    wsClient.on("reconnecting", () => {
      console.log(`Reconnecting WebSocket for wallet ${API_KEY}...`);
    });

    wsClient.on("close", () => {
      console.log(`WebSocket closed for wallet ${API_KEY}.`);
    });
  } catch (error) {
    console.error(`Error monitoring wallet ${API_KEY}:`, error.message || error);
  }
}