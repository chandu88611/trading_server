// src/app/trade/controllers/trade.controller.ts
import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest } from "../../../middleware/auth";
import { TradeService } from "../services/trade.service";
import { CopyTradeSideEnum } from "../../../db/enums";

export class TradeController {
  private service = new TradeService();

  @ControllerError()
  async create(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const { tradingAccountId, symbol, side, quantity, price, exchange } =
      req.body ?? {};

    // Validate required fields
    if (!tradingAccountId || !symbol || !side || !quantity) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    // Validate quantity is positive
    if (Number(quantity) <= 0) {
      res.status(400).json({ message: "invalid_quantity" });
      return;
    }

    // Validate side enum
    if (!Object.values(CopyTradeSideEnum).includes(side)) {
      res.status(400).json({ message: "invalid_side" });
      return;
    }

    const result = await this.service.createTrade(userId, {
      tradingAccountId: Number(tradingAccountId),
      symbol: String(symbol),
      side: side as CopyTradeSideEnum,
      quantity: Number(quantity),
      price: price != null ? Number(price) : null,
      exchange: exchange ?? null,
    });

    if (!result.ok && result.blocked) {
      res.status(403).json({
        message: "trade_not_allowed",
        reason: result.reason,
      });
      return;
    }

    res.status(201).json(result);
  }
}
