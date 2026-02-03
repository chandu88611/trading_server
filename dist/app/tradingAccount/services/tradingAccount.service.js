"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingAccountService = void 0;
// src/app/tradingAccount/services/tradingAccount.service.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const tradingAccount_db_1 = require("./tradingAccount.db");
const constants_1 = require("../../../types/constants");
class TradingAccountService {
    constructor() {
        this.db = new tradingAccount_db_1.TradingAccountDBService();
    }
    async listMyAccounts(userId) {
        try {
            return await this.db.listByUser(userId);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_list_trading_accounts",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async getMyAccountById(userId, accountId) {
        try {
            const account = await this.db.findById(userId, accountId);
            if (!account) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "trading_account_not_found",
                };
            }
            return account;
        }
        catch (error) {
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_fetch_trading_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async createMyAccount(userId, payload) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const account = await this.db.createForUserWithRunner(userId, payload, queryRunner);
            await queryRunner.commitTransaction();
            return account;
        }
        catch (error) {
            console.log(error);
            await queryRunner.rollbackTransaction();
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_create_trading_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            await queryRunner.release();
        }
    }
    async updateMyAccount(userId, accountId, payload) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const account = await this.db.updateForUserWithRunner(userId, accountId, payload, queryRunner);
            await queryRunner.commitTransaction();
            return account;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_update_trading_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            await queryRunner.release();
        }
    }
    async deleteMyAccount(userId, accountId) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.db.deleteForUserWithRunner(userId, accountId, queryRunner);
            await queryRunner.commitTransaction();
            return { success: true };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_delete_trading_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            await queryRunner.release();
        }
    }
}
exports.TradingAccountService = TradingAccountService;
