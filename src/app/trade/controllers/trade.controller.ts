// src/app/trade/controllers/trade.controller.ts
import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest } from "../../../middleware/auth";
import { TradeService } from "../services/trade.service";

export class TradeController {
  private service = new TradeService();

  @ControllerError()
  async getAllTrades(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const { start = 0, count = 10, searchParams, accountId, status } = req.query ?? {};
    if (accountId == null || accountId === "" || accountId === undefined) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }
    const result = await this.service.getAllTradesForUser({userId,accountId: String(accountId), start: Number(start), count: Number(count), searchParams: searchParams as string, status: status as string});
    res.status(200).json(result);
  }

  @ControllerError()
  async getSingleTrade(req: AuthRequest, res: Response) {
    let signalId = req.query.signalId;
    if(signalId == null || signalId === "" || signalId === undefined){
      res.status(400).json({ message: "missing_signal_id" });
      return;
    }
    const result = await this.service.getSignalStatusForTrade(Number(signalId));
    res.status(200).json(result);
  }

  @ControllerError()
  async getTradeHistory(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const { start=0, count=10, searchParams, accountId, status } = req.query ?? {};
    if (accountId == null || accountId === "" || accountId === undefined) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }
    const result = await this.service.getTradeHistory({userId, accountId: String(accountId), start: Number(start), count: Number(count), searchParams: searchParams as string, status: status as string});
    res.status(200).json(result);
  }

  @ControllerError()
  async closeTrade(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    let { signalIds, isCloseAll } = req.body ?? {};
    if((signalIds == null || signalIds.length === 0) && (isCloseAll == null || isCloseAll === undefined || isCloseAll === false)){
      res.status(400).json({ message: "missing_signal_ids" });
      return;
    }
    if(isCloseAll == null || isCloseAll === undefined){
      isCloseAll = false;
    }
    const result = await this.service.closeTrade(signalIds.map(Number), userId, isCloseAll);
    res.status(200).json(result);
  }
}