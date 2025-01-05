import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';

import { Api } from 'telegram/tl';
import * as readline from 'readline';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import bigInt, { BigInteger } from 'big-integer';
import { parseMessage } from './lib/util';
import { fetchWalletDetails } from './lib/fetch-wallets';
import { placeFuturesOrder } from './binance/order-manager';
import { handleCloseSignal } from './binance/close-signal';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let sessionString: string | undefined;

try {
  sessionString = fs.readFileSync('session.data', 'utf8');
  console.log('Session loaded from session.data');
} catch (e) {
  console.log('No saved session found.');
}

const apiId: number = parseInt(process.env.TELEGRAM_API_ID || '', 10);
const apiHash: string = process.env.TELEGRAM_API_HASH || '';
const channelID: BigInteger = bigInt(process.env.TELEGRAM_CHANNEL_ID || "0");

if (isNaN(apiId) || !apiHash) {
  console.error('Error: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in the .env file.');
  process.exit(1);
}

if (!channelID) {
  console.error('Error: TELEGRAM_CHANNEL_ID must be set in the .env file.');
  process.exit(1);
}


const stringSession = new StringSession(sessionString || '');
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

async function main(): Promise<void> {
  try {
    if (!sessionString) {
      await client.start({
        phoneNumber: async () => {
          return new Promise<string>((resolve) => {
            rl.question('Please enter your phone number: ', (input) => {
              resolve(input);
            });
          });
        },
        password: async () => {
          return new Promise<string>((resolve) => {
            rl.question('Please enter your 2FA password (if enabled): ', (input) => {
              resolve(input);
            });
          });
        },
        phoneCode: async () => {
          return new Promise<string>((resolve) => {
            rl.question('Please enter the code you received: ', (input) => {
              resolve(input);
            });
          });
        },
        onError: (err: Error) => {
          console.log('An error occurred during authentication:', err);
        },
      });
      sessionString = stringSession.save();
      fs.writeFileSync('session.data', sessionString);
      console.log('Session saved!');
      rl.close();
    } else {
      await client.connect();
    }

    console.log('Connected!');

    const channel = (await client.getEntity(
      new Api.InputPeerChannel({
        channelId: channelID,
        accessHash: bigInt(0), // Placeholder, will be fetched automatically
      })
    )) as Api.Channel;


    // Handler for new messages
    client.addEventHandler(
      async (event: NewMessageEvent) => {
        const message = event.message;

        if (message.peerId instanceof Api.PeerChannel) {
          const peerChannel = message.peerId as Api.PeerChannel;
          if (peerChannel.channelId.equals(channel.id)) {
            const parsedMessage = parseMessage(message.message);

            if (parsedMessage) {
              // Handle `CLOSE_SIGNAL` messages
              if (parsedMessage.type === "CLOSE_SIGNAL") {
                console.log(`Close signal detected for ${parsedMessage.pair} ${parsedMessage.direction}`);
                const wallets = await fetchWalletDetails();
                for (const wallet of wallets) {
                  await handleCloseSignal(parsedMessage, wallet);
                }
                // Handle `TRADE_SIGNAL` messages
              } else if (parsedMessage.type === "TRADE_SIGNAL") {
                const wallets = await fetchWalletDetails();

                for (const wallet of wallets) {
                  await placeFuturesOrder(parsedMessage, wallet);
                }
              } else {
                console.log("Unhandled message type. Ignoring.");
              }
            } else {
              console.log("Message could not be parsed. Ignoring.");
            }
          }
        }
      },
      new NewMessage({})
    );

  } catch (error) {
    console.error('Error connecting to Telegram:', error);
  }
}

main();
