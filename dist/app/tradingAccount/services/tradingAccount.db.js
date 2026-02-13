"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingAccountDBService = void 0;
// src/app/tradingAccount/services/tradingAccount.db.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
const constants_1 = require("../../../types/constants");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
class TradingAccountDBService {
    constructor() {
        this.repo = data_source_1.default.getRepository(UserTradingAccount_1.UserTradingAccount);
    }
    async listByUser(userId) {
        try {
            return await this.repo.find({
                where: { userId },
                order: { createdAt: "DESC" },
            });
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_listing_accounts",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async findById(userId, id) {
        try {
            return await this.repo.findOne({
                where: { id, userId },
            });
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_finding_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async createForUser(userId, payload) {
        try {
            // const acc = this.repo.create({
            //   userId,
            //   broker: payload.broker ?? null,
            //   isMaster: payload.isMaster ?? false,
            //   executionFlow: payload.executionFlow ?? null,
            //   accountLabel: payload.accountLabel ?? null,
            //   accountMeta: payload.accountMeta ?? null,
            //   credentialsEncrypted: payload.credentialsEncrypted ?? null,
            //   status: "PENDING_VERIFY",
            // });
            const acc = this.repo.create({
                userId,
                broker: payload.broker ?? "",
                isMaster: payload.isMaster ?? false,
                executionFlow: payload.executionFlow,
                accountLabel: payload.accountLabel ?? null,
                accountMeta: payload.accountMeta ?? null,
                credentialsEncrypted: payload.credentialsEncrypted ?? "",
                status: subscriberPlan_enum_1.TradingAccountStatus.PENDING, // Use the Enum instead of string
            });
            return await this.repo.save(acc);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_creating_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async alreadyMasterAccountExists(userId, broker) {
        try {
            const existing = await this.repo.
                createQueryBuilder("account")
                .where("account.user_id = :userId", { userId })
                .andWhere("account.broker = :broker", { broker })
                .andWhere("account.is_master = :isMaster", { isMaster: true })
                .getOne();
            if (existing) {
                throw {
                    statusCode: constants_1.HttpStatusCode._CONFLICT,
                    message: "you already have a master account for this broker cann't create another one",
                };
            }
            return;
        }
        catch (error) {
            throw error;
        }
    }
    async createForUserWithRunner(userId, payload, queryRunner) {
        try {
            await this.alreadyMasterAccountExists(userId, payload.broker ?? "");
            const acc = queryRunner.manager.create(UserTradingAccount_1.UserTradingAccount, {
                userId,
                broker: payload.broker ?? "",
                isMaster: payload.isMaster ?? false,
                executionFlow: payload.executionFlow,
                accountLabel: payload.accountLabel ?? null,
                accountMeta: payload.accountMeta ?? null,
                credentialsEncrypted: payload.credentialsEncrypted ?? "",
                status: subscriberPlan_enum_1.TradingAccountStatus.PENDING,
            });
            return await queryRunner.manager.save(acc);
        }
        catch (error) {
            throw error;
        }
    }
    async updateForUser(userId, id, payload) {
        try {
            const acc = await this.repo.findOne({ where: { id, userId } });
            if (!acc) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "trading_account_not_found",
                };
            }
            Object.assign(acc, payload);
            return await this.repo.save(acc);
        }
        catch (error) {
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_updating_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async updateForUserWithRunner(userId, id, payload, queryRunner) {
        try {
            const acc = await queryRunner.manager.findOne(UserTradingAccount_1.UserTradingAccount, {
                where: { id, userId },
            });
            if (!acc) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "trading_account_not_found",
                };
            }
            Object.assign(acc, payload);
            return await queryRunner.manager.save(acc);
        }
        catch (error) {
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_updating_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async deleteForUserWithRunner(userId, id, queryRunner) {
        try {
            const acc = await queryRunner.manager.findOne(UserTradingAccount_1.UserTradingAccount, {
                where: { id, userId },
            });
            if (!acc) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "trading_account_not_found",
                };
            }
            await queryRunner.manager.remove(acc);
        }
        catch (error) {
            if (error instanceof Object && 'statusCode' in error)
                throw error;
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_deleting_account",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
exports.TradingAccountDBService = TradingAccountDBService;
