// src/app/tradingAccount/controllers/tradingAccount.controller.ts
import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest } from "../../../middleware/auth";
import { TradingAccountService, CreateTradingAccountPayload, UpdateTradingAccountPayload } from "../services/tradingAccount.service";

export class TradingAccountController {
  private service = new TradingAccountService();

  @ControllerError()
  async listMyAccounts(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accounts = await this.service.listMyAccounts(userId);
    res.json({ accounts });
  }

  @ControllerError()
  async getMyAccountById(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accountId = Number(req.params.id);

    if (!accountId) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }

    const account = await this.service.getMyAccountById(userId, accountId);
    res.json({ account });
  }

  @ControllerError()
  async createMyAccount(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const payload: CreateTradingAccountPayload = req.body ?? {};

    if (!payload.accountLabel) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    const account = await this.service.createMyAccount(userId, payload);
    res.status(201).json({ account });
  }

  @ControllerError()
  async updateMyAccount(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accountId = Number(req.params.id);
    const payload: UpdateTradingAccountPayload = req.body ?? {};

    if (!accountId) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }

    const account = await this.service.updateMyAccount(userId, accountId, payload);
    res.json({ account });
  }

  @ControllerError()
  async deleteMyAccount(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accountId = Number(req.params.id);

    if (!accountId) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }

    await this.service.deleteMyAccount(userId, accountId);
    res.status(204).send();
  }
}
