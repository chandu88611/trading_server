// src/app/broker/services/brokerLink.service.ts
import AppDataSource from "../../../../db/data-source";
import { BrokerLinkDBService } from "./brokerLink.db";
import { HttpStatusCode } from "../../../../types/constants";

export class BrokerLinkService {
  private db = new BrokerLinkDBService();

  async linkBrokerToAccount(tradingAccountId: number, brokerId: number) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const link = await this.db.linkWithRunner(tradingAccountId, brokerId, queryRunner);
      await queryRunner.commitTransaction();
      return link;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_link_broker",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await queryRunner.release();
    }
  }

  async listBrokersForAccount(tradingAccountId: number) {
    try {
      return await this.db.listForAccount(tradingAccountId);
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_list_brokers",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async unlinkBrokerFromAccount(tradingAccountId: number, brokerId: number) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.db.unlinkWithRunner(tradingAccountId, brokerId, queryRunner);
      await queryRunner.commitTransaction();
      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_unlink_broker",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await queryRunner.release();
    }
  }
}
