import { USDMClient } from "binance";
import { PlacedOrder, TradeSignal, Wallet } from "../types";
import { monitorWalletAndCancelOnFilled } from "./websocket-manager";

export async function placeFuturesOrder(orders: TradeSignal, wallet: Wallet): Promise<void> {
  const { pair, direction, entry, targets, stopLoss } = orders;
  const { API_KEY, API_SECRET, balance, leverage } = wallet;

  try {
    // Initialize client
    const client = new USDMClient({
      api_key: API_KEY,
      api_secret: API_SECRET,
      beautifyResponses: true,
    });

    // Fetch exchange info
    const exchangeInfo = await client.getExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find((s) => s.symbol === pair);

    if (!symbolInfo) throw new Error(`Symbol ${pair} not found in exchange info.`);

    // Extract filters for precision
    const lotSizeFilter = symbolInfo.filters.find((f) => f.filterType === "LOT_SIZE");
    const priceFilter = symbolInfo.filters.find((f) => f.filterType === "PRICE_FILTER");

    if (!lotSizeFilter || !priceFilter) throw new Error(`Missing filters for symbol ${pair}.`);

    // Calculate the number of decimal places for stepSize
    const stepSizeStr = lotSizeFilter.stepSize.toString();
    const stepSizeDecimals = stepSizeStr.includes(".") ? stepSizeStr.split(".")[1].length : 0;

    // Calculate the number of decimal places for tickSize
    const tickSizeStr = priceFilter.tickSize.toString();
    const tickSizeDecimals = tickSizeStr.includes(".") ? tickSizeStr.split(".")[1].length : 0;

    const stepSizePrecision = stepSizeDecimals >= 0 ? stepSizeDecimals : 0;
    const tickSizePrecision = tickSizeDecimals >= 0 ? tickSizeDecimals : 0;
    console.log("Step size precision:", stepSizePrecision, "Price Tick size precision:", tickSizePrecision);
    // Fetch mark price
    const { markPrice } = await client.getMarkPrice({ symbol: pair });
    const currentPrice = parseFloat(markPrice.toString());
    await client.setLeverage({ symbol: pair, leverage });

    console.log(`Leverage set correctly for ${pair} x${leverage}`);

    // Calculate quantities
    const marketQty = parseFloat(((balance * leverage) / currentPrice).toFixed(stepSizePrecision));
    const side = direction === "LONG" ? "BUY" : "SELL";
    const oppositeSide = side === "BUY" ? "SELL" : "BUY";

    console.log("Placing Futures Orders...");
    console.log(`Market Qty: ${marketQty} @ ~${currentPrice}`);

    // Place MARKET order
    const marketOrder = await client.submitNewOrder({
      symbol: pair,
      side,
      type: "MARKET",
      quantity: marketQty,
    });
    console.log("Market order placed:", marketOrder.orderId);

    // Place STOP_MARKET order (stop-loss)
    const stopOrder = await client.submitNewOrder({
      symbol: pair,
      side: oppositeSide,
      type: "STOP_MARKET",
      stopPrice: parseFloat(stopLoss.toFixed(tickSizePrecision)),
      closePosition: "true",
    });
    console.log("Stop-loss order placed:", stopOrder.orderId);
    const placedOrders: PlacedOrder[] = [];

    // Place TAKE_PROFIT orders
    if (targets && targets.length > 0) {
      console.log("Targets:", targets.length);
      console.log("Precision: ", stepSizePrecision);
    
      // Calculate the base quantity for each TP order
      const baseQty = parseFloat((marketQty / targets.length).toFixed(stepSizePrecision));
    
      // Calculate the total quantity for the first (n-1) TP orders
      let totalTpQty = 0;
      for (let i = 0; i < targets.length - 1; i++) {
        totalTpQty += baseQty;
        console.log(`Order Quantity for TP${i}: ${baseQty}`);
      }
    
      // Calculate the remaining quantity for the trailing stop order
      const remainingQty = parseFloat((marketQty - totalTpQty).toFixed(stepSizePrecision));

      // Place TP orders for the first (n-1) targets
      for (let i = 0; i < targets.length - 1; i++) {
        const tpPrice = parseFloat(targets[i].toFixed(tickSizePrecision));

        const tpOrder = await client.submitNewOrder({
          symbol: pair,
          side: oppositeSide,
          type: "TAKE_PROFIT",
          stopPrice: tpPrice,
          price: parseFloat(targets[i].toFixed(tickSizePrecision)),
          quantity: baseQty,
          timeInForce: "GTC",
        });
        placedOrders.push({
          clientOrderId: tpOrder.clientOrderId,
          origPrice: tpPrice,
        });
  
        console.log(`Take-profit order placed @ ${targets[i]}`, tpOrder.orderId);
      }
    
      // Place TRAILING_STOP_MARKET order for the last TP level
      const trailingStopOrder = await client.submitNewOrder({
        symbol: pair,
        side: oppositeSide,
        type: "TRAILING_STOP_MARKET",
        activationPrice: parseFloat(targets[targets.length - 1].toFixed(tickSizePrecision)),
        callbackRate: 0.2, // 2% trailing
        quantity: remainingQty,
      });


      placedOrders.push({
        clientOrderId: trailingStopOrder.clientOrderId,
        origPrice: parseFloat(targets[targets.length - 1].toFixed(tickSizePrecision)),
      });

      console.log(`Trailing Stop placed (activation @ ${targets[targets.length - 1]}):`, trailingStopOrder.orderId);
    }

    console.log("All orders placed successfully. Opening Websocket connection...");
    monitorWalletAndCancelOnFilled(wallet, placedOrders, orders);
  } catch (error) {
    console.error("Error placing futures order:", error);
  }
}