// src/app/broker/controllers/brokerLink.controller.ts
import { Response } from "express";
import { ControllerError } from "../../../../types/error-handler";
import { AuthRequest } from "../../../../middleware/auth";
import { BrokerLinkService } from "../services/brokerLink.service";

export class BrokerLinkController {
  private service = new BrokerLinkService();

  @ControllerError()
  async listBrokersForAccount(req: AuthRequest, res: Response) {
    const tradingAccountId = Number(req.params.accountId);

    if (!tradingAccountId) {
      res.status(400).json({ message: "missing_trading_account_id" });
      return;
    }

    const brokers = await this.service.listBrokersForAccount(tradingAccountId);
    res.json({ brokers });
  }

  @ControllerError()
  async linkBrokerToAccount(req: AuthRequest, res: Response) {
    const tradingAccountId = Number(req.params.accountId);
    const { brokerId } = req.body ?? {};

    if (!tradingAccountId || !brokerId) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    const link = await this.service.linkBrokerToAccount(tradingAccountId, Number(brokerId));
    res.status(201).json({ link });
  }

  @ControllerError()
  async unlinkBrokerFromAccount(req: AuthRequest, res: Response) {
    const tradingAccountId = Number(req.params.tradingAccountId);
    const brokerId = Number(req.params.brokerId);

    if (!tradingAccountId || !brokerId) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    await this.service.unlinkBrokerFromAccount(tradingAccountId, brokerId);
    res.status(204).send();
  }
}
