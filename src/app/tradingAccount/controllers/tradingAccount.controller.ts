// src/app/tradingAccount/controllers/tradingAccount.controller.ts
import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest } from "../../../middleware/auth";
import { TradingAccountService, CreateTradingAccountPayload, UpdateTradingAccountPayload } from "../services/tradingAccount.service";
import { marketDataProviderEnum, UserTradeType } from "../../../db/enums";

export class TradingAccountController {
  private service = new TradingAccountService();

  @ControllerError()
  async listMyAccounts(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const planId = Number(req.query.planId);
    if(planId === undefined || planId === null || isNaN(planId)) {
      res.status(400).json({ message: "missing_plan_id" });
      return;
    }
    const accounts = await this.service.listMyAccounts(userId, planId);
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
    console.log("Received request to create trading account with payload", { userId, payload }); 
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

  // @ControllerError()
  // async allowCopyTrading(req: AuthRequest, res: Response) {
  //   const userId = Number(req.auth!.userId);
  //   const payload: { allow: boolean, userTradingAccountId: number, masterAccountId: number } = req.body ?? {};

  //   if (payload.allow === undefined) {
  //     res.status(400).json({ message: "missing_allow_field" });
  //     return;
  //   }

  //   // await this.service.setCopyTradingPermission(userId, payload.allow);
  //   res.json({ message: `you allowed copy trading ${payload.allow} for userTradingAccountId ${payload.userTradingAccountId} and masterAccountId ${payload.masterAccountId}` });
  // }

  // @ControllerError()
  // async handleCopyTradingRequest(req: AuthRequest, res: Response) {
  //   const userId = Number(req.auth!.userId);
  //   const payload: { userTradingAccountId: number, userEmail: string, masterAccountId: number } = req.body ?? {};

  //     if (!payload.userTradingAccountId || !payload.userEmail || !payload.masterAccountId) {
  //       res.status(400).json({ message: "missing_required_fields" });
  //       return;
  //     }
  //   // await this.service.handleCopyTradingRequest(userId, payload.requestId, payload.accept);
  //   res.json({ message: `you handled copy trading request for userTradingAccountId ${payload.userTradingAccountId} and masterAccountId ${payload.masterAccountId}` });
  // }

  @ControllerError()
  async getCopyTradingRequests(req: AuthRequest, res: Response) {
    console.log("Received request to get copy trading requests", { userId: req.auth!.userId });
    const userId = Number(req.auth!.userId);
    let {count, start, searchParams} = req.query ?? {};
    if(count === undefined) {
      count = '10';
    }
    if(start === undefined) {
      start = '0';
    }



    const requests = await this.service.getCopyTradingRequests(userId);
    res.json({ requests });

  }

  @ControllerError()
  async handleCopyTradingRequest(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const payload: {
       userTradingAccountId: number, 
       userEmail: string } = req.body ?? {};

    if ( !payload.userTradingAccountId || !payload.userEmail) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    await this.service.makingCopyTradingRequestToMasterFromFollower({userId, userTradingAccountId: payload.userTradingAccountId, userEmail: payload.userEmail});
    res.json({ message: `you made copy trading request from userTradingAccountId ${payload.userTradingAccountId}` });
  }

  @ControllerError()
  async allowCopyTrading(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const payload: { requestId: number, approve: boolean } = req.body ?? {};

    if (!payload.requestId || payload.approve === undefined) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    await this.service.approveCopyTradingRequestFromFollower(payload.requestId, payload.approve);
    res.json({ message: `you ${payload.approve ? 'approved' : 'rejected'} copy trading request ${payload.requestId}` });
  }

}