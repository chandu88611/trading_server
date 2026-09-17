import { MamLinksService } from "../services/mamLinks.service";
import { ActivityFeedService } from "../services/activityFeed.service";
import {getUserFillMetrics} from "../services/fillMetrics.service";
import { subscribeTradeEvents } from "../services/tradeEvents.service";
import { EmergencyHaltService } from "../services/emergencyHalt.service";
// src/app/trade/controllers/trade.controller.ts
import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest, Roles } from "../../../middleware/auth";
import { TradeService } from "../services/trade.service";
import { TradeAlertService } from "../services/tradeAlert.service";
import AppDataSource from "../../../db/data-source";

export class TradeController {
  @ControllerError()
  async resumeTrading(req:AuthRequest,res:Response) {
    const accountId=req.body?.accountId;
    if(typeof accountId!=="number") {res.status(400).json({message:"invalid_account_id"});return;}
    res.json(await new EmergencyHaltService().resume(Number(req.auth!.userId),accountId));
  }
  @ControllerError()
  async activityFeed(req:AuthRequest,res:Response) {res.json({data:await new ActivityFeedService().list(Number(req.auth!.userId),req.query.accountId===undefined?undefined:Number(req.query.accountId))});}
  @ControllerError()
  async listMamLinks(req:AuthRequest,res:Response) {res.json({data:await new MamLinksService().list(Number(req.auth!.userId),Number(req.params.masterAccountId))});}
  @ControllerError()
  async createMamLink(req:AuthRequest,res:Response) {res.status(201).json({data:await new MamLinksService().create(Number(req.auth!.userId),req.body)});}
  @ControllerError()
  async updateMamLink(req:AuthRequest,res:Response) {res.json({data:await new MamLinksService().update(Number(req.auth!.userId),Number(req.params.id),req.body)});}
  @ControllerError()
  async deleteMamLink(req:AuthRequest,res:Response) {await new MamLinksService().update(Number(req.auth!.userId),Number(req.params.id),{},true);res.status(204).send();}

  @ControllerError()
  async getFillMetrics(req:AuthRequest,res:Response) {
    res.json({data:await getUserFillMetrics(Number(req.auth!.userId))});
  }

  @ControllerError()
  async emergencyHalt(req: AuthRequest, res: Response) {
    const scope = req.body?.accountId;
    if (scope !== "ALL" && (!Number.isSafeInteger(Number(scope)) || Number(scope) <= 0)) {
      res.status(400).json({ message: "invalid_account_scope" }); return;
    }
    const result = await new EmergencyHaltService().request(Number(req.auth!.userId), scope === "ALL" ? "ALL" : Number(scope));
    res.status(202).json(result);
  }

  events(req: AuthRequest, res: Response) { subscribeTradeEvents(Number(req.auth!.userId),res); }

  private service = new TradeService();
  private alertService = new TradeAlertService();

  private ensureAdmin(req: AuthRequest) {
    if (!req.auth?.roles?.includes(Roles.ADMIN)) {
      throw {
        statusCode: 401,
        message: "Admin access required",
      };
    }
  }

  private parsePositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

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

  @ControllerError()
  async listTradeAlerts(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const start = Number(req.query.start ?? 0);
    const count = Number(req.query.count ?? 20);
    const unreadOnly = String(req.query.unreadOnly ?? "false").toLowerCase() === "true";

    const result = await this.alertService.listForUser(userId, {
      start: Number.isFinite(start) ? start : 0,
      count: Number.isFinite(count) ? count : 20,
      unreadOnly,
    });
    res.status(200).json(result);
  }

  @ControllerError()
  async markTradeAlertRead(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const alertId = this.parsePositiveInt(req.params.alertId);
    if (!alertId) {
      res.status(400).json({ message: "invalid_trade_alert_id" });
      return;
    }

    const result = await this.alertService.markRead(userId, alertId);
    res.status(200).json({
      message: "trade_alert_marked_read",
      data: result,
    });
  }

  @ControllerError()
  async markAllTradeAlertsRead(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const result = await this.alertService.markAllRead(userId);
    res.status(200).json({
      message: "trade_alerts_marked_read",
      data: result,
    });
  }

  @ControllerError()
  async listAdminStrategyTrades(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const start = Number(req.query.start ?? 0);
    const count = Number(req.query.count ?? 20);
    const strategyIdParam = req.query.strategyId
      ? this.parsePositiveInt(req.query.strategyId)
      : undefined;
    const planIdParam = req.query.planId
      ? this.parsePositiveInt(req.query.planId)
      : undefined;

    if (req.query.strategyId && !strategyIdParam) {
      res.status(400).json({ message: "invalid_strategy_id" });
      return;
    }
    if (req.query.planId && !planIdParam) {
      res.status(400).json({ message: "invalid_plan_id" });
      return;
    }

    const result = await this.service.listAdminStrategyTrades({
      strategyId: strategyIdParam ?? undefined,
      planId: planIdParam ?? undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      start: Number.isFinite(start) ? start : 0,
      count: Number.isFinite(count) ? count : 20,
    });
    res.status(200).json(result);
  }

  @ControllerError()
  async getAdminStrategyTrade(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const adminStrategyTradeId = this.parsePositiveInt(
      req.params.adminStrategyTradeId
    );
    if (!adminStrategyTradeId) {
      res.status(400).json({ message: "invalid_admin_strategy_trade_id" });
      return;
    }

    const result = await this.service.getAdminStrategyTrade(adminStrategyTradeId);
    res.status(200).json(result);
  }

  @ControllerError()
  async closeAdminStrategyTrade(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const adminStrategyTradeId = this.parsePositiveInt(
      req.params.adminStrategyTradeId
    );
    if (!adminStrategyTradeId) {
      res.status(400).json({ message: "invalid_admin_strategy_trade_id" });
      return;
    }

    const result = await this.service.closeAdminStrategyTrade(adminStrategyTradeId);
    res.status(200).json(result);
  }

  @ControllerError()
  async getMyPnl(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const period = String(req.query.period ?? "30d");

    let daysBack: number | null = null;
    if (period === "7d") daysBack = 7;
    else if (period === "30d") daysBack = 30;
    else if (period === "90d") daysBack = 90;

    const dateFilter = daysBack
      ? `AND ts.created_at >= NOW() - INTERVAL '${daysBack} days'`
      : "";

    const daily = await AppDataSource.query(
      `SELECT
         DATE_TRUNC('day', ts.created_at) AS day,
         SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
             CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
         ) AS pnl,
         COUNT(*) AS trades,
         ts.symbol
       FROM trade_signals ts
       INNER JOIN trade_signals_status tss ON tss.signal_id = ts.id
       WHERE ts.user_id = $1
         AND tss.status IN ('completed', 'closed', 'executed')
         ${dateFilter}
       GROUP BY DATE_TRUNC('day', ts.created_at), ts.symbol
       ORDER BY day DESC`,
      [userId],
    );

    const summary = await AppDataSource.query(
      `SELECT
         COUNT(*) AS total_trades,
         SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
             CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
         ) AS total_pnl,
         COUNT(DISTINCT ts.symbol) AS unique_symbols
       FROM trade_signals ts
       INNER JOIN trade_signals_status tss ON tss.signal_id = ts.id
       WHERE ts.user_id = $1
         AND tss.status IN ('completed', 'closed', 'executed')
         ${dateFilter}`,
      [userId],
    );

    const s = summary[0] ?? {};
    res.json({
      data: {
        summary: {
          totalTrades: Number(s.total_trades ?? 0),
          totalPnl: Number(s.total_pnl ?? 0),
          uniqueSymbols: Number(s.unique_symbols ?? 0),
          period,
        },
        daily: daily.map((r: any) => ({
          date: r.day,
          pnl: Number(r.pnl ?? 0),
          trades: Number(r.trades ?? 0),
          symbol: r.symbol,
        })),
      },
    });
  }
}
