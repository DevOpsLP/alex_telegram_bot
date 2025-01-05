import { USDMClient } from "binance";
import { TradeSignal, Wallet } from "../../types";
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

    const stepSizeDecimals = lotSizeFilter.stepSize.toString().indexOf("1") - lotSizeFilter.stepSize.toString().indexOf(".") - 1;
    const tickSizeDecimals = priceFilter.tickSize.toString().indexOf("1") - priceFilter.tickSize.toString().indexOf(".") - 1;

    const stepSizePrecision = stepSizeDecimals >= 0 ? stepSizeDecimals : 0;
    const tickSizePrecision = tickSizeDecimals >= 0 ? tickSizeDecimals : 0;
    console.log("Step size", stepSizePrecision, "Price Tick size", tickSizePrecision);
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

    // Place TAKE_PROFIT orders
    if (targets && targets.length > 0) {
      for (let i = 0; i < targets.length - 1; i++) {
        const tpOrder = await client.submitNewOrder({
          symbol: pair,
          side: oppositeSide,
          type: "TAKE_PROFIT",
          stopPrice: parseFloat(targets[i].toFixed(tickSizePrecision)),
          price: parseFloat(targets[i].toFixed(tickSizePrecision)),
          quantity: parseFloat((marketQty / targets.length).toFixed(stepSizePrecision)),
          timeInForce: "GTC",
        });
        console.log(`Take-profit order placed @ ${targets[i]}`, tpOrder.orderId);
      }

      // Place TRAILING_STOP_MARKET order for the last TP level
      const trailingStopOrder = await client.submitNewOrder({
        symbol: pair,
        side: oppositeSide,
        type: "TRAILING_STOP_MARKET",
        activationPrice: parseFloat(targets[targets.length - 1].toFixed(tickSizePrecision)),
        callbackRate: 2, // 2% trailing
        quantity: parseFloat((marketQty / targets.length).toFixed(stepSizePrecision)),
      });
      console.log(`Trailing Stop placed (activation @ ${targets[targets.length - 1]}):`, trailingStopOrder.orderId);
    }

    console.log("All orders placed successfully. Opening Websocket connection...");
    monitorWalletAndCancelOnFilled(wallet, orders);
  } catch (error) {
    console.error("Error placing futures order:", error);
  }
}