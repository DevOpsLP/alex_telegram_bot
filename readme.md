## Getting Started: Telegram API Credentials

To use this system, you need to set up your Telegram API credentials and obtain your target channel ID. Follow the steps below:

---

### Step 1: Get Your `API_ID` and `API_HASH`

1. Visit [auth.telegram.org](https://auth.telegram.org).
2. Follow the authentication process by logging in with your Telegram account.
3. After logging in, create an app (if not already created):
   - Provide a name and short description for your app.
   - Telegram will generate an `API_ID` and an `API_HASH` for your app.
4. Save these credentials.

---

### Step 2: Add Credentials to the `.env` File

1. Create a `.env` file in the root directory of the project (if it doesn't exist).
2. Add the following lines to the file:
``` env
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
```

Replace your_api_id and your_api_hash with the values you obtained in Step 1.

Step 3: Get the TELEGRAM_CHANNEL_ID
	1.	Navigate to web.telegram.org and log in.
	2.	Select the channel where the signals will be sent.
	3.	Look at the URL in your browser. It will look something like this for a private channel: https://web.telegram.org/k/#-1974460050
	4.	Extract the numbers after the #-. In this example, it’s 1974460050.
	5.	Add this value to your .env file:

TELEGRAM_CHANNEL_ID=1974460050

## Ensuring Wallet Details Configuration

In the file `src/lib/fetch-wallets`, there is a placeholder function that demonstrates the structure of the data it should return. This function is a placeholder and must be properly configured to return an array of wallet details.

---

### File: `src/lib/fetch-wallets`
```typescript
import { Wallet } from "../../types";

export const fetchWalletDetails = async (): Promise<Wallet[]> => {
    // Your logic goes here
    // Call he database or anything you want.
    
    return [
      {
        API_KEY: YOUR_KEY, // String
        API_SECRET: YOUR_SECRET, // String
        balance: 5, // INTEGER
        leverage: 30 // INTEGER
      },
    ];
};
```

### Expected Return Structure

The function should return an array of objects, each adhering to the Wallet type. Each object in the array must include the following properties:
	•	**API_KEY**: A string containing the API key for the wallet.
	•	**API_SECRET**: A string containing the secret key for the wallet.
	•	**balance**: A number representing the wallet’s balance. **THIS MUST BE IN USDT**
	•	**leverage**: A number representing the leverage associated with the wallet.

Example Return Data

Here is an example of what the function should return:
``` json
[
  {
    API_KEY: "your-binance-api-key",
    API_SECRET: "your-binance-api-secret",
    balance: 10, // USDT VALUE
    leverage: 20 // INTEGER
  },
  {
    API_KEY: "another-api-key",
    API_SECRET: "another-api-secret",
    balance: 15,
    leverage: 25
  }
];
```
---
# Run the  project

- Copy repository
- Install dependencies by doing `npm install`
- Run the project by doing: `npm run start`