import { ParsedMessage, TradeSignal, CloseSignal } from "../../types";

export function parseMessage(messageText: string): ParsedMessage | null {
  try {
    // Split the message into lines and trim each line
    const lines = messageText.split('\n').map((line) => line.trim());

    // Primary regular expressions for parsing
    const pairRegex = /#(\w+)\/(\w+)/; // Matches #1000SHIB/USDT
    const directionRegex = /🟢\s*Long|🔴\s*SHORT|#(Short|Long)/i; // Updated to include #Short and #Long
    const closeSignalRegex = /Close the Signal/i; // Matches "Close the Signal"
    const entryRegex = /Entry\s*[:：]\s*([\d.]+)\s*-\s*([\d.]+)/; // Matches Entry range
    const targetRegex = /🎯\s*([\d.]+)/g; // Matches multiple 🎯 targets
    const stopLossRegex = /🛑\s*Stop\s*[:：]\s*([\d.]+)/; // Matches 🛑 Stop value

    // Secondary regex for alternative parsing (pair and direction in the same line)
    const alternativePairAndDirectionRegex = /#(\w+)\/(\w+)\s+#(Short|Long)/i;

    // Check for "Close Signal" first
    if (lines.some((line) => closeSignalRegex.test(line))) {
      const pairMatch = lines.find((line) => pairRegex.test(line))?.match(pairRegex);
      const directionMatch = lines.find((line) => directionRegex.test(line))?.match(directionRegex);
    
      if (pairMatch) {
        return {
          type: "CLOSE_SIGNAL",
          pair: `${pairMatch[1]}${pairMatch[2]}`, // Combine the pair without the slash
          direction: directionMatch
            ? directionMatch[0].toLowerCase().includes("long")
              ? "LONG"
              : "SHORT"
            : undefined, // Default to undefined if no direction
        } as CloseSignal;
      }
    
      console.error("Incomplete close signal data. The parsed fields are:", { pairMatch, directionMatch });
      return null; // Invalid close signal
    }

    // Parse the message as a trade signal
    const tradeSignal: Partial<TradeSignal> = {
      targets: [],
    };

    // Primary parsing using the main regex patterns
    for (const line of lines) {
      let match: RegExpExecArray | null;

      if ((match = pairRegex.exec(line))) {
        tradeSignal.pair = `${match[1]}${match[2]}`; // Combine the pair without the slash
      } else if ((match = directionRegex.exec(line))) {
        tradeSignal.direction = line.includes("Long") ? "LONG" : "SHORT";
      } else if ((match = entryRegex.exec(line))) {
        tradeSignal.entry = [parseFloat(match[1]), parseFloat(match[2])];
      } else if ((match = stopLossRegex.exec(line))) {
        tradeSignal.stopLoss = parseFloat(match[1]);
      }
    }

    // Parse targets separately
    let match: RegExpExecArray | null;
    while ((match = targetRegex.exec(messageText))) {
      const targetValue = parseFloat(match[1]);
      if (!isNaN(targetValue)) {
        tradeSignal.targets?.push(targetValue);
      }
    }

    // If primary parsing failed, attempt secondary parsing
    if (!tradeSignal.pair || !tradeSignal.direction) {
      const alternativeLine = lines.find((line) =>
        alternativePairAndDirectionRegex.test(line)
      );
      if (alternativeLine) {
        const altMatch = alternativePairAndDirectionRegex.exec(alternativeLine);
        if (altMatch) {
          tradeSignal.pair = `${altMatch[1]}${altMatch[2]}`;
          // Convert direction to "LONG" or "SHORT" and ensure type safety
          const direction = altMatch[3].toUpperCase() as "LONG" | "SHORT";
          tradeSignal.direction = direction;
        }
      }
    }

    // Validate and return the trade signal
    if (
      tradeSignal.pair &&
      tradeSignal.direction &&
      Array.isArray(tradeSignal.entry) &&
      tradeSignal.entry.length === 2 &&
      tradeSignal.targets &&
      tradeSignal.targets.length > 0 &&
      tradeSignal.stopLoss !== undefined
    ) {
      return { ...tradeSignal, type: "TRADE_SIGNAL" } as TradeSignal;
    }

    console.error("Incomplete trade signal data. The parsed fields are:", tradeSignal);
    return null;
  } catch (error) {
    console.error("Error parsing message:", error.message);
    return null;
  }
}