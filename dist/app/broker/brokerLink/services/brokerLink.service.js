"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerLinkService = void 0;
// src/app/broker/services/brokerLink.service.ts
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const brokerLink_db_1 = require("./brokerLink.db");
const constants_1 = require("../../../../types/constants");
class BrokerLinkService {
    constructor() {
        this.db = new brokerLink_db_1.BrokerLinkDBService();
    }
    async linkBrokerToAccount(tradingAccountId, brokerId) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const link = await this.db.linkWithRunner(tradingAccountId, brokerId, queryRunner);
            await queryRunner.commitTransaction();
            return link;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_link_broker",
                error: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            await queryRunner.release();
        }
    }
    async listBrokersForAccount(tradingAccountId) {
        try {
            return await this.db.listForAccount(tradingAccountId);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_list_brokers",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async unlinkBrokerFromAccount(tradingAccountId, brokerId) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.db.unlinkWithRunner(tradingAccountId, brokerId, queryRunner);
            await queryRunner.commitTransaction();
            return { success: true };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_unlink_broker",
                error: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            await queryRunner.release();
        }
    }
}
exports.BrokerLinkService = BrokerLinkService;
