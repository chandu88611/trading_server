// src/app/tradingAccount/services/tradingAccount.db.ts
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
 
import { HttpStatusCode } from "../../../types/constants";
import { In, QueryRunner } from "typeorm";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { CopyTradingMaster } from "../../../entity/CopyTradingMaster";
import { errorHandler } from "../../../types/error-handler";

export class TradingAccountDBService {
  private repo = AppDataSource.getRepository(UserTradingAccount);
  private copyTradingRepo = AppDataSource.getRepository(CopyTradingMaster);

  async listByUser(userId: number, planId: number) {
    try {
      console.log("Listing trading accounts for user", { userId, planId });
      return await this.repo.find({
        where: { userId,   } as any,
        order: { createdAt: "DESC" },
      });
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

  async createForUser(
    userId: number,
    payload: {
      broker?: string | null;
      isMaster?: boolean;
      executionFlow?: string | null;
      accountLabel?: string | null;
      accountMeta?: Record<string, any> | null;
      credentialsEncrypted?: string | null;
    }
  ) {
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
      status: TradingAccountStatus.PENDING, // Use the Enum instead of string
    } as any);

      return await this.repo.save(acc);
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_creating_account",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  async alreadyMasterAccountExists(userId: number, broker: string) {
    try {
      const existing = await this.repo.
      createQueryBuilder("account")
      .where("account.user_id = :userId", { userId })
      .andWhere("account.broker = :broker", { broker })
      .andWhere("account.is_master = :isMaster", { isMaster: true })
      .getOne();
      if (existing) {
        throw{
          statusCode: HttpStatusCode._CONFLICT,
          message: "you already have a master account for this broker cann't create another one",
        }
      }
      return;
    } catch (error) {
      throw error
    }
  }

  async createForUserWithRunner(
    userId: number,
    payload: {
      broker?: string | null;
      isMaster?: boolean;
      executionFlow?: string | null;
      accountLabel?: string | null;
      accountMeta?: Record<string, any> | null;
      credentialsEncrypted?: string | null;
    },
    queryRunner: QueryRunner
  ) {
    try {
      await this.alreadyMasterAccountExists(userId, payload.broker ?? "");
const acc = queryRunner.manager.create(UserTradingAccount, {
        userId,
        broker: payload.broker ?? "",
        isMaster: payload.isMaster ?? false,
        executionFlow: payload.executionFlow as any, 
        accountLabel: payload.accountLabel ?? null,
        accountMeta: payload.accountMeta ?? null,
        credentialsEncrypted: payload.credentialsEncrypted ?? "",
        status: TradingAccountStatus.PENDING ,  
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
        },
      });

      let ids: { userId: number; id: number }[] = userTradingAccounts.map((account) => ({ userId: account.userId, id: account.id }));
      return ids
    } catch (error) {
      throw error
    }
  }

  async makingCopyTradingRequestToMasterFromFollower(
  data: { userId: number; masterAccountId: number; userTradingAccountId: number },
  queryRunner: QueryRunner
) {
  try {
    const copyTradingEntry = queryRunner.manager.create(CopyTradingMaster, {
      masterTradingAccountId: data.masterAccountId,
      userTradingAccountId: data.userTradingAccountId,
      isActive: true,  
    } as any);

    return await queryRunner.manager.save(copyTradingEntry);
  } catch (error) {
    throw error;
  }
}






}