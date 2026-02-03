"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeService = void 0;
// src/app/trade/services/trade.service.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const tradeGuard_service_1 = require("./tradeGuard.service");
const trade_db_1 = require("./trade.db");
const ctraderGateway_client_1 = require("../../../infra/ctraderGateway.client");
const trade_identify_1 = require("../../../types/trade-identify");
const constants_1 = require("../../../types/constants");
class TradeService {
    constructor() {
        this.guard = new tradeGuard_service_1.TradeGuardService();
        this.db = new trade_db_1.TradeDBService();
        this.gateway = new ctraderGateway_client_1.CtraderGatewayClient();
    }
    async createTrade(userId, payload) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const { symbol, exchange } = payload;
            // 1) check plan & user status
            const check = await this.guard.checkTradeAllowed({
                userId,
                symbol,
                exchange,
            });
            if (!check.allowed) {
                return {
                    ok: false,
                    blocked: true,
                    reason: check.reason,
                };
            }
            // 2) call gateway to actually place the order
            let gwResp;
            try {
                gwResp = await this.gateway.placeOrder({
                    tradingAccountId: payload.tradingAccountId,
                    symbol: payload.symbol,
                    side: payload.side,
                    quantity: payload.quantity,
                    price: payload.price ?? null,
                });
            }
            catch (error) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "gateway_order_placement_failed",
                    error: error instanceof Error ? error.message : String(error),
                };
            }
            // 3) log trade signal
            const assetType = trade_identify_1.AssetClassifier.detect({ symbol, exchange });
            const signal = await this.db.logSignalWithRunner({
                userId,
                side: payload.side,
                symbol,
                price: payload.price ?? null,
                exchange: payload.exchange ?? null,
                assetType,
            }, queryRunner);
            await queryRunner.commitTransaction();
            return {
                ok: true,
                gateway: gwResp,
                signal,
                subscriptionId: check.subscriptionId ?? null,
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof Object && 'statusCode' in error) {
                throw error;
            }
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_create_trade",
                error: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            await queryRunner.release();
        }
    }
}
exports.TradeService = TradeService;
