// src/app/tradingAccount/services/tradingAccount.db.ts
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
 
import { HttpStatusCode } from "../../../types/constants";
import { QueryRunner } from "typeorm";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";

export class TradingAccountDBService {
  private repo = AppDataSource.getRepository(UserTradingAccount);

  async listByUser(userId: number) {
    try {
      return await this.repo.find({
        where: { userId },
        order: { createdAt: "DESC" },
      });
    } catch (error) {
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
      console.log(error)
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_creating_account",
        error: error instanceof Error ? error.message : String(error),
      };
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
}
