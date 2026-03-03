"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingAccountDBService = void 0;
// src/app/tradingAccount/services/tradingAccount.db.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
const User_1 = require("../../../entity/User");
const constants_1 = require("../../../types/constants");
const typeorm_1 = require("typeorm");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const CopyTradingMaster_1 = require("../../../entity/CopyTradingMaster");
const CopyTradingFollow_1 = require("../../../entity/CopyTradingFollow");
const entity_1 = require("../../../entity");
const Market_1 = require("../../../entity/Market");
class TradingAccountDBService {
    constructor() {
        this.repo = data_source_1.default.getRepository(UserTradingAccount_1.UserTradingAccount);
        this.brokerRepo = data_source_1.default.getRepository(entity_1.Broker);
        this.copyTradingRepo = data_source_1.default.getRepository(CopyTradingMaster_1.CopyTradingMaster);
        this.copyTradingFollowersRepo = data_source_1.default.getRepository(CopyTradingFollow_1.CopyTradingFollowers);
    }
    async listByUser(userId, planId) {
        try {
            let data = await this.repo.find({
                where: { userId, subscription: { planId } },
                order: { createdAt: "DESC" },
                relations: [
                    "broker",
                    "subscription",
                    "subscription.plan",
                    "subscription.plan.pricing",
                    "subscription.plan.market",
                    "subscription.plan.planType",
                    "subscription.plan.features",
                    "subscription.plan.limits",
                    "subscription.plan.planStrategies",
                    "subscription.plan.includedInBundles",
                    "subscription.plan.includedInBundles.bundlePlan",
                    "subscription.plan.includedInBundles.bundlePlan.pricing",
                    "subscription.plan.includedInBundles.bundlePlan.market",
                    "subscription.plan.includedInBundles.bundlePlan.planType",
                    "copyTradingFollowingAccounts",
                ]
            });
            console.log("Fetched trading accounts for user", { userId, planId, count: data.length });
            return data;
        }
        catch (error) {
            console.error("Error listing trading accounts for user", { userId, planId, error });
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
    async alreadyMasterAccountExists(userId, marketCategory, isMaster, accountId, queryRunner) {
        try {
            const existing = await queryRunner.manager
                .createQueryBuilder(UserTradingAccount_1.UserTradingAccount, "account")
                .leftJoinAndSelect("account.broker", "broker")
                .where("account.user_id = :userId", { userId })
                .andWhere("broker.market_category = :marketCategory", { marketCategory })
                .andWhere("account.is_master = :isMaster", { isMaster: isMaster })
                .andWhere("account.account_id = :accountId", { accountId })
                .getOne();
            console.log("Checked for existing master account", { userId, marketCategory, isMaster, accountId, existing });
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
    async getSubscriptionIdForAccount(userId, market, queryRunner) {
        try {
            console.log("Fetching subscription ID for account", { userId, market });
            let marketData = await queryRunner.manager.findOne(Market_1.Market, { where: { code: market } });
            if (!marketData) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "market_not_found",
                };
            }
            let subscription = await queryRunner.manager.createQueryBuilder(entity_1.UserSubscription, "subscription")
                .innerJoinAndSelect("subscription.plan", "plan")
                .where("subscription.user_id = :userId", { userId })
                .andWhere("plan.market_id = :marketId", { marketId: marketData.id })
                .andWhere("subscription.status_v2 = :status", { status: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE })
                .getOne();
            if (!subscription) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "subscription_not_found",
                };
            }
            return subscription.id;
        }
        catch (error) {
            throw error;
        }
    }
    async createForUserWithRunner(userId, payload, queryRunner) {
        try {
            let brokerCode = payload.broker === "CTrader" ? "CT" : payload.broker;
            let brokerId = await queryRunner.manager.findOne(entity_1.Broker, { where: { code: brokerCode ?? undefined } });
            if (brokerId === null) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "broker_not_found",
                };
            }
            let subscriberPlanId = await this.getSubscriptionIdForAccount(userId, brokerId.marketCategory, queryRunner);
            let accountId = payload.accountLabel?.split("•").pop()?.trim() ?? null;
            await this.alreadyMasterAccountExists(userId, brokerId.marketCategory, payload.isMaster ?? false, accountId, queryRunner);
            console.log("Creating trading account for user with runner", { userId, payload });
            console.log("Extracted accountId", { accountId });
            const acc = queryRunner.manager.create(UserTradingAccount_1.UserTradingAccount, {
                userId,
                brokerId: brokerId?.id ?? null,
                accountId: accountId,
                isMaster: payload.isMaster ?? false,
                accountLabel: payload.accountLabel ?? null,
                accountMeta: payload.accountMeta ?? null,
                credentialsEncrypted: payload.credentialsEncrypted ?? "",
                status: subscriberPlan_enum_1.TradingAccountStatus.PENDING,
                subscriptionId: subscriberPlanId,
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
    async getActiveMasterAccountCopyAndFollowing(userId, brokerIds) {
        try {
            const itemData = await this.repo.find({
                where: {
                    userId: userId,
                    brokerId: (0, typeorm_1.In)(brokerIds),
                    isMaster: true,
                    status: subscriberPlan_enum_1.TradingAccountStatus.VERIFIED,
                    isEnabled: true,
                },
            });
            if (!itemData || itemData.length === 0) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "no_active_master_account_found",
                };
            }
            let copyTradingData = await this.getAllCopyTradingAccounts(itemData.map(item => item.id));
            return [...copyTradingData, ...itemData.map(item => ({ userId: item.userId, id: item.id }))];
        }
        catch (error) {
            throw error;
        }
    }
    async getAllCopyTradingAccounts(masterAccountIds) {
        try {
            const itemData = await this.copyTradingRepo.find({
                where: {
                    masterTradingAccountId: (0, typeorm_1.In)(masterAccountIds),
                    isActive: true,
                },
            });
            let UserTradingAccountIds = itemData.map((item) => item.userTradingAccountId);
            const userTradingAccounts = await this.repo.find({
                where: {
                    id: (0, typeorm_1.In)(UserTradingAccountIds),
                    status: subscriberPlan_enum_1.TradingAccountStatus.VERIFIED,
                    isEnabled: true,
                },
            });
            let ids = userTradingAccounts.map((account) => ({ userId: account.userId, id: account.id }));
            return ids;
        }
        catch (error) {
            throw error;
        }
    }
    async getMasterId({ UserTradingAccountId, userId, queryRunner }) {
        try {
            let accountDetails = await queryRunner.manager.findOne(UserTradingAccount_1.UserTradingAccount, { where: { id: UserTradingAccountId }, relations: ['broker'] });
            console.log("Fetched account details for master ID retrieval", { UserTradingAccountId, accountDetails });
            if (!accountDetails) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "trading_account_not_found",
                };
            }
            let BrokerCategory = accountDetails.broker.marketCategory;
            let masterAccount = await queryRunner.manager.findOne(UserTradingAccount_1.UserTradingAccount, { where: { broker: { marketCategory: BrokerCategory }, userId: userId, isMaster: true } });
            if (!masterAccount) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "master_trading_account_not_found",
                };
            }
            return masterAccount.id;
        }
        catch (error) {
            throw error;
        }
    }
    async makingCopyTradingRequestToMasterFromFollower(data, queryRunner) {
        try {
            const masterId = await this.getMasterId({ UserTradingAccountId: data.userTradingAccountId, userId: data.userId, queryRunner });
            const followerUserId = await queryRunner.manager.findOne(User_1.User, {
                where: { email: data.userEmail },
            });
            if (!followerUserId) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "follower_user_not_found",
                };
            }
            // Get master trading account with user details
            const masterAccount = await queryRunner.manager.findOne(UserTradingAccount_1.UserTradingAccount, {
                where: { id: masterId },
                relations: ['user'],
            });
            if (!masterAccount) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "master_trading_account_not_found",
                };
            }
            // Get follower user details
            const followerUser = await queryRunner.manager.findOne(User_1.User, {
                where: { id: data.userId },
            });
            if (!followerUser) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "follower_user_not_found",
                };
            }
            const copyTradingEntry = queryRunner.manager.create(CopyTradingFollow_1.CopyTradingFollowers, {
                masterId: masterId,
                followerTradingAccountId: data.userTradingAccountId,
                followerUserId: followerUserId.id,
                status: CopyTradingFollow_1.CopyFollowStatus.PENDING,
                requestedAt: new Date(),
            });
            const savedEntry = await queryRunner.manager.save(copyTradingEntry);
            return {
                entry: savedEntry,
                masterUser: masterAccount.user,
                followerUser: followerUser,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async approveCopyTradingRequest(requestId, approve, queryRunner) {
        try {
            const request = await queryRunner.manager.findOne(CopyTradingFollow_1.CopyTradingFollowers, {
                where: { id: requestId },
            });
            if (!request) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "copy_trading_request_not_found",
                };
            }
            if (approve) {
                request.status = CopyTradingFollow_1.CopyFollowStatus.ACTIVE;
                request.approvedAt = new Date();
            }
            else {
                request.status = CopyTradingFollow_1.CopyFollowStatus.REJECTED;
            }
            await queryRunner.manager.save(request);
            const copyTradingMaster = queryRunner.manager.create(CopyTradingMaster_1.CopyTradingMaster, {
                masterTradingAccountId: request.masterId,
                userTradingAccountId: request.followerTradingAccountId,
                isActive: approve,
            });
            await queryRunner.manager.save(copyTradingMaster);
        }
        catch (error) {
            throw error;
        }
    }
    async getCopyTradingRequestsForMaster(userId) {
        try {
            const requests = await this.copyTradingFollowersRepo.find({
                where: {
                    followerUserId: userId,
                    status: CopyTradingFollow_1.CopyFollowStatus.PENDING,
                },
                relations: ['master', 'master.user']
            });
            return requests;
        }
        catch (error) {
            console.error("Error fetching copy trading requests for master", { userId, error });
            throw error;
        }
    }
}
exports.TradingAccountDBService = TradingAccountDBService;
