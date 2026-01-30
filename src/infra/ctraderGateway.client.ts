// src/infra/ctraderGateway.client.ts
import axios from "axios";

const BASE_URL = process.env.CTRADER_GATEWAY_URL || "http://localhost:4000";

export type PlaceOrderPayload = {
  tradingAccountId: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price?: number | null;
};

export class CtraderGatewayClient {
  private http = axios.create({
    baseURL: BASE_URL,
    timeout: 10_000,
  });

  async placeOrder(payload: PlaceOrderPayload) {
    // Adjust path/body to your gateway API
    const res = await this.http.post("/orders", payload);
    return res.data;
  }
}
