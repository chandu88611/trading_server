// src/app/tradingAccount/services/tradingAccount.db.ts
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { User } from "../../../entity/User";
import { HttpStatusCode } from "../../../types/constants";
import { In, QueryRunner } from "typeorm";
import { SubscriptionStatus, TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { CopyTradingMaster } from "../../../entity/CopyTradingMaster";
import { errorHandler } from "../../../types/error-handler";
import { CopyFollowStatus, CopyTradingFollowers } from "../../../entity/CopyTradingFollow";
import { Broker, SubscriptionPlan, UserSubscription } from "../../../entity";
import { subscribe } from "diagnostics_channel";
import { Market } from "../../../entity/Market";

export class TradingAccountDBService {
  private repo = AppDataSource.getRepository(UserTradingAccount);
  private brokerRepo = AppDataSource.getRepository(Broker);
  private copyTradingRepo = AppDataSource.getRepository(CopyTradingMaster);
  private copyTradingFollowersRepo = AppDataSource.getRepository(CopyTradingFollowers);

  async listByUser(userId: number, planId: number) {
    try {
      let data =  await this.repo.find({
        where: { userId, subscription:{planId} },
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
    } catch (error) {
      console.error("Error listing trading accounts for user", { userId, planId, error });
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_listing_accounts",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findById(userId: number, id: number) {
    try {
      return await this.repo.findOne({
        where: { id, userId },
      });
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_finding_account",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async alreadyMasterAccountExists(userId: number, marketCategory: string, isMaster: boolean, accountId: string | null, queryRunner: QueryRunner) {
    try {
      const existing = await queryRunner.manager
        .createQueryBuilder(UserTradingAccount, "account")
        .leftJoinAndSelect("account.broker", "broker")
        .where("account.user_id = :userId", { userId })
        .andWhere("broker.market_category = :marketCategory", { marketCategory })
        .andWhere("account.is_master = :isMaster", { isMaster: isMaster })
        .andWhere("account.account_id = :accountId", { accountId })
        .getOne();
        console.log("Checked for existing master account", { userId, marketCategory, isMaster, accountId, existing });
      if (existing) {
        throw {
          statusCode: HttpStatusCode._CONFLICT,
          message: "you already have a master account for this broker cann't create another one",
        };
      }
      return;
    } catch (error) {
      throw error;
    }
  }

  async getSubscriptionIdForAccount(userId: number, market: string, queryRunner: QueryRunner) {
    try {
      console.log("Fetching subscription ID for account", { userId, market });
      let marketData = await queryRunner.manager.findOne(Market, { where: { code: market } });
      if (!marketData) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "market_not_found",
        }
      }
      let subscription = await queryRunner.manager.createQueryBuilder(UserSubscription, "subscription")
        .innerJoinAndSelect("subscription.plan", "plan")
        .where("subscription.user_id = :userId", { userId })
        .andWhere("plan.market_id = :marketId", { marketId: marketData.id })
        .andWhere("subscription.status_v2 = :status", { status: SubscriptionStatus.ACTIVE })
        .getOne();
      if (!subscription) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "subscription_not_found",
        }
      }
      return subscription.id;
    } catch (error) {
      throw error
    }
  }

  async createForUserWithRunner(
    userId: number,
    payload: {
      broker?: string | null;
      accountId?: string | null;
      isMaster?: boolean;
      executionFlow?: string | null;
      accountLabel?: string | null;
      accountMeta?: Record<string, any> | null;
      credentialsEncrypted?: string | null;
    },
    queryRunner: QueryRunner
  ) {
    try {
      let brokerCode = payload.broker === "CTrader" ? "CT" : payload.broker;
      let brokerId = await queryRunner.manager.findOne(Broker, { where: { code: brokerCode ?? undefined } });
      if(brokerId === null) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "broker_not_found",
        }
      }
      let subscriberPlanId = await this.getSubscriptionIdForAccount(userId, brokerId.marketCategory,queryRunner);
      let accountId = payload.accountLabel?.split("•").pop()?.trim() ?? null;
      await this.alreadyMasterAccountExists(userId, brokerId.marketCategory, payload.isMaster ?? false, accountId, queryRunner);
      console.log("Creating trading account for user with runner", { userId, payload });
      
      console.log("Extracted accountId", { accountId });
      const acc = queryRunner.manager.create(UserTradingAccount, {
        userId,
        brokerId: brokerId?.id ?? null,
        accountId: accountId,
        isMaster: payload.isMaster ?? false,
        accountLabel: payload.accountLabel ?? null,
        accountMeta: payload.accountMeta ?? null,
        credentialsEncrypted: payload.credentialsEncrypted ?? "",
        status: TradingAccountStatus.PENDING,
        subscriptionId: subscriberPlanId,
      } as any);
      return await queryRunner.manager.save(acc);
    } catch (error) {
      throw error;
    }
  }

  async updateForUser(
    userId: number,
    id: number,
    payload: Partial<{
      isMaster: boolean;
      isEnabled: boolean;
      executionFlow: string | null;
      accountLabel: string | null;
      accountMeta: Record<string, any> | null;
      status: string | null;
    }>
  ) {
    try {
      const acc = await this.repo.findOne({ where: { id, userId } });
      if (!acc) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "trading_account_not_found",
        };
      }

      Object.assign(acc, payload);
      return await this.repo.save(acc);
    } catch (error) {
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_updating_account",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateForUserWithRunner(
    userId: number,
    id: number,
    payload: Partial<{
      isMaster: boolean;
      isEnabled: boolean;
      executionFlow: string | null;
      accountLabel: string | null;
      accountMeta: Record<string, any> | null;
      status: string | null;
    }>,
    queryRunner: QueryRunner
  ) {
    try {
      const acc = await queryRunner.manager.findOne(UserTradingAccount, {
        where: { id, userId },
      });
      if (!acc) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "trading_account_not_found",
        };
      }

      Object.assign(acc, payload);
      return await queryRunner.manager.save(acc);
    } catch (error) {
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_updating_account",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteForUserWithRunner(userId: number, id: number, queryRunner: QueryRunner) {
    try {
      const acc = await queryRunner.manager.findOne(UserTradingAccount, {
        where: { id, userId },
      });
      if (!acc) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "trading_account_not_found",
        };
      }

      await queryRunner.manager.remove(acc);
    } catch (error) {
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_deleting_account",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getActiveMasterAccountCopyAndFollowing(userId: number, brokerIds: number[]) {
    try {
      const itemData = await this.repo.find({
        where: {
          userId: userId,
          brokerId: In(brokerIds),
          isMaster: true,
          status: TradingAccountStatus.VERIFIED,
          isEnabled: true,
        },
      });
      if (!itemData || itemData.length === 0) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "no_active_master_account_found",
        };
      }
      let copyTradingData: {
        userId: number;
        id: number;
      }[] = await this.getAllCopyTradingAccounts(itemData.map(item => item.id));
      return [...copyTradingData, ...itemData.map(item => ({ userId: item.userId, id: item.id }))];
    } catch (error) {
      throw error
    }
  }
  async getAllCopyTradingAccounts(masterAccountIds: number[]) {
    try {
      const itemData = await this.copyTradingRepo.find({
        where: {
          masterTradingAccountId: In(masterAccountIds),
          isActive: true,
        },
      });
      let UserTradingAccountIds = itemData.map((item) => item.userTradingAccountId);
      const userTradingAccounts = await this.repo.find({
        where: {
          id: In(UserTradingAccountIds),
          status: TradingAccountStatus.VERIFIED,
          isEnabled: true,
        },
      });

      let ids: { userId: number; id: number }[] = userTradingAccounts.map((account) => ({ userId: account.userId, id: account.id }));
      return ids
    } catch (error) {
      throw error
    }
  }
  async getMasterId({UserTradingAccountId, userId, queryRunner}: {UserTradingAccountId: number, userId: number, queryRunner: QueryRunner}) {
    try {
      let accountDetails = await queryRunner.manager.findOne(UserTradingAccount, { where: { id: UserTradingAccountId }, relations: ['broker'] });
      console.log("Fetched account details for master ID retrieval", { UserTradingAccountId, accountDetails });
      if (!accountDetails) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "trading_account_not_found",
        };
      }
      let BrokerCategory = accountDetails.broker.marketCategory;
      let masterAccount = await queryRunner.manager.findOne(UserTradingAccount, { where: { broker: { marketCategory: BrokerCategory }, userId: userId, isMaster: true } });
      if (!masterAccount) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "master_trading_account_not_found",
        };
      }
      return masterAccount.id;
    } catch (error) {
      throw error
    }
  }

  async makingCopyTradingRequestToMasterFromFollower(
    data: { userId: number;  userTradingAccountId: number , userEmail: string},
    queryRunner: QueryRunner
  ) {
    try {
      const masterId: number = await this.getMasterId({UserTradingAccountId: data.userTradingAccountId, userId: data.userId, queryRunner});
      const followerUserId = await queryRunner.manager.findOne(User, {
        where: { email: data.userEmail },
      });
      if (!followerUserId) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "follower_user_not_found",
        };
      }
      // Get master trading account with user details
      const masterAccount = await queryRunner.manager.findOne(UserTradingAccount, {
        where: { id: masterId },
        relations: ['user'],
      });

      if (!masterAccount) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "master_trading_account_not_found",
        };
      }

      // Get follower user details
      const followerUser = await queryRunner.manager.findOne(User, {
        where: { id: data.userId },
      });

      if (!followerUser) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "follower_user_not_found",
        };
      }

      const copyTradingEntry = queryRunner.manager.create(CopyTradingFollowers, {
        masterId: masterId,
        followerTradingAccountId: data.userTradingAccountId,
        followerUserId: followerUserId.id,
        status: CopyFollowStatus.PENDING,
        requestedAt: new Date(),
      });

      const savedEntry = await queryRunner.manager.save(copyTradingEntry);

      return {
        entry: savedEntry,
        masterUser: masterAccount.user,
        followerUser: followerUser,
      };
    } catch (error) {
      throw error;
    }
  }

  async approveCopyTradingRequest(requestId: number, approve: boolean, queryRunner: QueryRunner) {
    try {
      const request = await queryRunner.manager.findOne(CopyTradingFollowers, {
        where: { id: requestId },
      });
      if (!request) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "copy_trading_request_not_found",
        };
      }

      if (approve) {
        request.status = CopyFollowStatus.ACTIVE;
        request.approvedAt = new Date();
      } else {
        request.status = CopyFollowStatus.REJECTED;
      }

      await queryRunner.manager.save(request);
      
      const copyTradingMaster = queryRunner.manager.create(CopyTradingMaster, {
        masterTradingAccountId: request.masterId,
        userTradingAccountId: request.followerTradingAccountId,
        isActive: approve,
      });
      await queryRunner.manager.save(copyTradingMaster);
    } catch (error) {
      throw error;
    }
  }

  async getCopyTradingRequestsForMaster(userId: number) {
    try {
      const requests = await this.copyTradingFollowersRepo.find({
        where: {
          followerUserId: userId,
          status: CopyFollowStatus.PENDING,
        }
      , relations: ['master', 'master.user']
      });

      return requests
    } catch (error) {
      console.error("Error fetching copy trading requests for master", { userId, error });
      throw error;
    } 
  }




}
