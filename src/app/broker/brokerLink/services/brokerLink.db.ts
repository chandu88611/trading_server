// src/app/broker/services/brokerLink.db.ts
import AppDataSource from "../../../../db/data-source";
import {
  BrokerTradingAccountDetails as BrokerLink,
} from "../../../../entities";
import { HttpStatusCode } from "../../../../types/constants";
import { QueryRunner } from "typeorm";

export class BrokerLinkDBService {
  private repo = AppDataSource.getRepository(BrokerLink);

  async link(tradingAccountId: number, brokerId: number) {
    try {
      const existing = await this.repo.findOne({
        where: { tradingAccountId, brokerId },
      });

      if (existing) return existing;

      const link = this.repo.create({
        tradingAccountId,
        brokerId,
      });
      return await this.repo.save(link);
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_linking_broker",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async linkWithRunner(tradingAccountId: number, brokerId: number, queryRunner: QueryRunner) {
    try {
      const existing = await queryRunner.manager.findOne(BrokerLink, {
        where: { tradingAccountId, brokerId },
      });

      if (existing) return existing;

      const link = queryRunner.manager.create(BrokerLink, {
        tradingAccountId,
        brokerId,
      });
      return await queryRunner.manager.save(link);
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_linking_broker",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listForAccount(tradingAccountId: number) {
    try {
      return await this.repo.find({ where: { tradingAccountId } });
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_listing_broker_links",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async unlink(tradingAccountId: number, brokerId: number) {
    try {
      const link = await this.repo.findOne({ where: { tradingAccountId, brokerId } });
      if (!link) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "broker_link_not_found",
        };
      }
      await this.repo.remove(link);
    } catch (error) {
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_unlinking_broker",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async unlinkWithRunner(tradingAccountId: number, brokerId: number, queryRunner: QueryRunner) {
    try {
      const link = await queryRunner.manager.findOne(BrokerLink, {
        where: { tradingAccountId, brokerId },
      });
      if (!link) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "broker_link_not_found",
        };
      }
      await queryRunner.manager.remove(link);
    } catch (error) {
      if (error instanceof Object && 'statusCode' in error) throw error;
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_unlinking_broker",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
