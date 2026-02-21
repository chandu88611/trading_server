"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    async getAllCopyTradingAccounts(userId, brokerIds) {
        try {
            let userTradingAccounts = await this.db.getActiveMasterAccountCopyAndFollowing(userId, brokerIds);
            return userTradingAccounts;
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_list_copy_trading_accounts",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async listMyAccounts(userId, planId) {
        try {
            return await this.db.listByUser(userId, planId);
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
            await queryRunner.rollbackTransaction();
            throw error;
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
    async makingCopyTradingRequestToMasterFromFollower({ userId, userTradingAccountId, userEmail }) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const result = await this.db.makingCopyTradingRequestToMasterFromFollower({ userId, userTradingAccountId, userEmail }, queryRunner);
            await queryRunner.commitTransaction();
            // Send email invitation to user/follower
            try {
                const { sendCopyTradingRequestEmail } = await Promise.resolve().then(() => __importStar(require("../../../types/email.service")));
                await sendCopyTradingRequestEmail({
                    masterEmail: result.masterUser.email,
                    masterName: result.masterUser.name || 'Master Trader',
                    followerName: result.followerUser.name || 'User',
                    followerEmail: result.followerUser.email,
                    requestId: result.entry.id,
                });
            }
            catch (emailError) {
                // Log email error but don't fail the request
                console.error('Failed to send copy trading invitation email:', emailError);
            }
            return { success: true };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async approveCopyTradingRequestFromFollower(requestId, approve) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.db.approveCopyTradingRequest(requestId, approve, queryRunner);
            await queryRunner.commitTransaction();
            return { success: true };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getCopyTradingRequests(userId) {
        try {
            return await this.db.getCopyTradingRequestsForMaster(userId);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_fetch_copy_trading_requests",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
exports.TradingAccountService = TradingAccountService;
