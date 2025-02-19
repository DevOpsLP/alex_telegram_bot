import { USDMClient, WebsocketClient } from "binance";
import { PlacedOrder, TradeSignal, Wallet } from "../types";

export async function monitorWalletAndCancelOnFilled(
  wallet: Wallet,
  placedOrders: PlacedOrder[],
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

      if (
        data.eventType === "ORDER_TRADE_UPDATE" && // Check if it's an ORDER_TRADE_UPDATE event
        data.order.executionType === "TRADE" && // Check if Execution Type is TRADE
        data.order.orderStatus === "FILLED" // Check if Order Status is FILLED
      ) {
        const order = data.order; // Extract order details
        const { symbol, originalOrderType, orderId, clientOrderId } = order;

        // Handle STOP_MARKET or TRAILING_STOP_MARKET being filled
        if (originalOrderType === "STOP_MARKET" || originalOrderType === "TRAILING_STOP_MARKET") {
          console.log(`${originalOrderType} order FILLED for ${symbol}. Cancelling all open orders.`);
          // Fetch all open orders for the symbol
          try {
            const openOrders = await client.getAllOpenOrders({ symbol });
  
            if (openOrders.length > 0) {
              console.log(`Cancelling ${openOrders.length} open orders for ${symbol}...`);
              for (const openOrder of openOrders) {
                try {
                  await client.cancelOrder({ symbol, orderId: openOrder.orderId });
                  console.log(`Cancelled order ID: ${openOrder.orderId}`);
                } catch (cancelError: any) {
                  console.error(`Error cancelling order ID ${openOrder.orderId}:`, cancelError.message || cancelError);
                }
              }
            } else {
              console.log(`No open orders to cancel for ${symbol}.`);
            }
  
            console.log(`All necessary actions completed for ${symbol}.`);
            // Close the WebSocket after actions are complete
            wsClient.close(`All necessary actions completed for ${symbol}.`);
          } catch (error: any) {
            console.error(`Error fetching or cancelling orders for ${symbol}:`, error.message || error);
          }
        }else if (originalOrderType === "TAKE_PROFIT") {
          console.log(`Take profit filled for ${symbol}. Adjusting stop loss...`);
          
          // Find which placed TP/trailing order just got filled
          const matchedOrder = placedOrders.find((p) => p.clientOrderId === clientOrderId);

          if (!matchedOrder) {
            console.log(`No matching placedOrder found for clientOrderId: ${clientOrderId}. Ignoring.`);
            return;
          }
        
          // The filled price is the one we originally used to place this TP
          const filledPrice = matchedOrder.origPrice;
          console.log(`Filled price from matchedOrder: ${filledPrice}`);

          // Determine index of the filled price among the tradeSignal's targets
          const tpIndex = tradeSignal.targets.findIndex(tp => tp === filledPrice);

          if (tpIndex === -1) {
            console.log(`Filled price ${filledPrice} not in tradeSignal.targets. Ignoring.`);
            return;
          }

          // Calculate new SL price:
          let newStopLossPrice: number;

          if (tpIndex === 0) {
            // TP1 => move SL to entry
            newStopLossPrice = tradeSignal.entry[0];
          } else {
            // If TP2 or higher => move SL to the previous TP
            // (Example: if TP2 is filled => move SL to TP1, if TP3 filled => move SL to TP2, etc.)
            const targetIndex = tpIndex - 1;
            if (targetIndex < 0 || targetIndex >= tradeSignal.targets.length) {
              console.log(`No valid TP target at index ${targetIndex}. Ignoring.`);
              return;
            }
            newStopLossPrice = tradeSignal.targets[targetIndex];
          }

          console.log(`SL will be updated to ${newStopLossPrice}`);
        
          try {
            // Get all open orders
            const openOrders = await client.getAllOpenOrders({ symbol });
            // Filter for the STOP_MARKET orders (stop loss orders)
            const slOrders = openOrders.filter(o => o.type === "STOP_MARKET");
            for (const slOrder of slOrders) {
              // Modify the existing SL order with the new price instead of cancelling it
              await client.cancelOrder({
                orderId: slOrder.orderId,
                symbol,
              });
              const stopOrder = await client.submitNewOrder({
                symbol: symbol,
                side: slOrder.side,
                type: "STOP_MARKET",
                stopPrice: newStopLossPrice,
                closePosition: "true",
              });
              console.log(`New order SL order ${JSON.stringify(stopOrder, null, 2)} to new price ${newStopLossPrice}`);
            }
        
          } catch (error: any) {
            console.error(`Error adjusting SL for ${symbol}:`, error.message || error);
          }
        } else {
          console.log(`Ignoring order type: ${originalOrderType}`);
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
  } catch (error: any) {
    console.error(`Error monitoring wallet ${API_KEY}:`, error.message || error);
  }
}