// src/app/tradingAccount/services/tradingAccount.service.ts
import AppDataSource from "../../../db/data-source";
import { TradingAccountDBService } from "./tradingAccount.db";
import { HttpStatusCode } from "../../../types/constants";

export type CreateTradingAccountPayload = {
  broker?: string | null;
  isMaster?: boolean;
  executionFlow?: string | null;
  accountLabel?: string | null;
  accountMeta?: Record<string, any> | null;
  credentialsEncrypted?: string | null;
};

export type UpdateTradingAccountPayload = Partial<{
  isMaster: boolean;
  executionFlow: string | null;
  accountLabel: string | null;
  accountMeta: Record<string, any> | null;
  status: string | null;
}>;

export class TradingAccountService {
  private db = new TradingAccountDBService();

  async listMyAccounts(userId: number) {
    try {
      return await this.db.listByUser(userId);
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_list_trading_accounts",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getMyAccountById(userId: number, accountId: number) {
    try {
      const account = await this.db.findById(userId, accountId);
      if (!account) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "trading_account_not_found",
        };
      }
      return account;
    } catch (error) {
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_fetch_trading_account",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createMyAccount(userId: number, payload: CreateTradingAccountPayload) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await this.db.createForUserWithRunner(userId, payload, queryRunner);
      await queryRunner.commitTransaction();
      return account;
    } catch (error) {
      console.log(error)
      await queryRunner.rollbackTransaction();
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_create_trading_account",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await queryRunner.release();
    }
  }

  async updateMyAccount(
    userId: number,
    accountId: number,
    payload: UpdateTradingAccountPayload
  ) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await this.db.updateForUserWithRunner(userId, accountId, payload, queryRunner);
      await queryRunner.commitTransaction();
      return account;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_update_trading_account",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await queryRunner.release();
    }
  }

  async deleteMyAccount(userId: number, accountId: number) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.db.deleteForUserWithRunner(userId, accountId, queryRunner);
      await queryRunner.commitTransaction();
      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_delete_trading_account",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await queryRunner.release();
    }
  }
}
