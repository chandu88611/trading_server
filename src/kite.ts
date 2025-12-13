import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.KITE_API_KEY;
const requestToken = process.env.KITE_REQUEST_TOKEN;
const apiSecret = process.env.KITE_API_SECRET;

export async function initKite(): Promise<void> {
  if (!apiKey) {
    console.log("Kite: KITE_API_KEY not set — skipping Kite initialization");
    return;
  }

  // lazy require to avoid module errors when not installed in some setups
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { KiteConnect } = require("kiteconnect");

  const kc = new KiteConnect({ api_key: apiKey });

  if (requestToken && apiSecret) {
    try {
      await kc.generateSession(requestToken, apiSecret);
      console.log("Kite: session generated");
    } catch (err) {
      console.error("Kite: generateSession error", err);
      return;
    }
  } else {
    console.log(
      "Kite: request token or api secret not provided — skipping generateSession"
    );
  }

  try {
    const margins = await kc.getMargins();
    console.log(
      "Kite: margins fetched",
      margins && typeof margins === "object" ? "ok" : "no-data"
    );
  } catch (err) {
    console.error("Kite: getMargins error", err);
  }
}
