"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CtraderGatewayClient = void 0;
// src/infra/ctraderGateway.client.ts
const axios_1 = __importDefault(require("axios"));
const BASE_URL = process.env.CTRADER_GATEWAY_URL || "http://localhost:4000";
class CtraderGatewayClient {
    constructor() {
        this.http = axios_1.default.create({
            baseURL: BASE_URL,
            timeout: 10000,
        });
    }
    async placeOrder(payload) {
        // Adjust path/body to your gateway API
        const res = await this.http.post("/orders", payload);
        return res.data;
    }
}
exports.CtraderGatewayClient = CtraderGatewayClient;
