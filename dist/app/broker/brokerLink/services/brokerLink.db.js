"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerLinkDBService = void 0;
// src/app/broker/services/brokerLink.db.ts
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const entities_1 = require("../../../../entities");
const constants_1 = require("../../../../types/constants");
class BrokerLinkDBService {
    constructor() {
        this.repo = data_source_1.default.getRepository(entities_1.BrokerTradingAccountDetails);
    }
    async link(tradingAccountId, brokerId) {
        try {
            const existing = await this.repo.findOne({
                where: { tradingAccountId, brokerId },
            });
            if (existing)
                return existing;
            const link = this.repo.create({
                tradingAccountId,
                brokerId,
            });
            return await this.repo.save(link);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_linking_broker",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async linkWithRunner(tradingAccountId, brokerId, queryRunner) {
        try {
            const existing = await queryRunner.manager.findOne(entities_1.BrokerTradingAccountDetails, {
                where: { tradingAccountId, brokerId },
            });
            if (existing)
                return existing;
            const link = queryRunner.manager.create(entities_1.BrokerTradingAccountDetails, {
                tradingAccountId,
                brokerId,
            });
            return await queryRunner.manager.save(link);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_linking_broker",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async listForAccount(tradingAccountId) {
        try {
            return await this.repo.find({ where: { tradingAccountId } });
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_listing_broker_links",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async unlink(tradingAccountId, brokerId) {
        try {
            const link = await this.repo.findOne({ where: { tradingAccountId, brokerId } });
            if (!link) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "broker_link_not_found",
                };
            }
            await this.repo.remove(link);
        }
        catch (error) {
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_unlinking_broker",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async unlinkWithRunner(tradingAccountId, brokerId, queryRunner) {
        try {
            const link = await queryRunner.manager.findOne(entities_1.BrokerTradingAccountDetails, {
                where: { tradingAccountId, brokerId },
            });
            if (!link) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "broker_link_not_found",
                };
            }
            await queryRunner.manager.remove(link);
        }
        catch (error) {
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_unlinking_broker",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
exports.BrokerLinkDBService = BrokerLinkDBService;
