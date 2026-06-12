"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const auth_1 = require("../../../middleware/auth");
const trade_service_1 = require("../services/trade.service");
const tradeAlert_service_1 = require("../services/tradeAlert.service");
const data_source_1 = __importDefault(require("../../../db/data-source"));
class TradeController {
    constructor() {
        this.service = new trade_service_1.TradeService();
        this.alertService = new tradeAlert_service_1.TradeAlertService();
    }
    ensureAdmin(req) {
        if (!req.auth?.roles?.includes(auth_1.Roles.ADMIN)) {
            throw {
                statusCode: 401,
                message: "Admin access required",
            };
        }
    }
    parsePositiveInt(value) {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            return null;
        }
        return parsed;
    }
    async getAllTrades(req, res) {
        const userId = Number(req.auth.userId);
        const { start = 0, count = 10, searchParams, accountId, status } = req.query ?? {};
        if (accountId == null || accountId === "" || accountId === undefined) {
            res.status(400).json({ message: "missing_account_id" });
            return;
        }
        const result = await this.service.getAllTradesForUser({ userId, accountId: String(accountId), start: Number(start), count: Number(count), searchParams: searchParams, status: status });
        res.status(200).json(result);
    }
    async getSingleTrade(req, res) {
        let signalId = req.query.signalId;
        if (signalId == null || signalId === "" || signalId === undefined) {
            res.status(400).json({ message: "missing_signal_id" });
            return;
        }
        const result = await this.service.getSignalStatusForTrade(Number(signalId));
        res.status(200).json(result);
    }
    async getTradeHistory(req, res) {
        const userId = Number(req.auth.userId);
        const { start = 0, count = 10, searchParams, accountId, status } = req.query ?? {};
        if (accountId == null || accountId === "" || accountId === undefined) {
            res.status(400).json({ message: "missing_account_id" });
            return;
        }
        const result = await this.service.getTradeHistory({ userId, accountId: String(accountId), start: Number(start), count: Number(count), searchParams: searchParams, status: status });
        res.status(200).json(result);
    }
    async closeTrade(req, res) {
        const userId = Number(req.auth.userId);
        let { signalIds, isCloseAll } = req.body ?? {};
        if ((signalIds == null || signalIds.length === 0) && (isCloseAll == null || isCloseAll === undefined || isCloseAll === false)) {
            res.status(400).json({ message: "missing_signal_ids" });
            return;
        }
        if (isCloseAll == null || isCloseAll === undefined) {
            isCloseAll = false;
        }
        const result = await this.service.closeTrade(signalIds.map(Number), userId, isCloseAll);
        res.status(200).json(result);
    }
    async listTradeAlerts(req, res) {
        const userId = Number(req.auth.userId);
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
    async markTradeAlertRead(req, res) {
        const userId = Number(req.auth.userId);
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
    async markAllTradeAlertsRead(req, res) {
        const userId = Number(req.auth.userId);
        const result = await this.alertService.markAllRead(userId);
        res.status(200).json({
            message: "trade_alerts_marked_read",
            data: result,
        });
    }
    async listAdminStrategyTrades(req, res) {
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
    async getAdminStrategyTrade(req, res) {
        this.ensureAdmin(req);
        const adminStrategyTradeId = this.parsePositiveInt(req.params.adminStrategyTradeId);
        if (!adminStrategyTradeId) {
            res.status(400).json({ message: "invalid_admin_strategy_trade_id" });
            return;
        }
        const result = await this.service.getAdminStrategyTrade(adminStrategyTradeId);
        res.status(200).json(result);
    }
    async closeAdminStrategyTrade(req, res) {
        this.ensureAdmin(req);
        const adminStrategyTradeId = this.parsePositiveInt(req.params.adminStrategyTradeId);
        if (!adminStrategyTradeId) {
            res.status(400).json({ message: "invalid_admin_strategy_trade_id" });
            return;
        }
        const result = await this.service.closeAdminStrategyTrade(adminStrategyTradeId);
        res.status(200).json(result);
    }
    async getMyPnl(req, res) {
        const userId = Number(req.auth.userId);
        const period = String(req.query.period ?? "30d");
        let daysBack = null;
        if (period === "7d")
            daysBack = 7;
        else if (period === "30d")
            daysBack = 30;
        else if (period === "90d")
            daysBack = 90;
        const dateFilter = daysBack
            ? `AND ts.created_at >= NOW() - INTERVAL '${daysBack} days'`
            : "";
        const daily = await data_source_1.default.query(`SELECT
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
       ORDER BY day DESC`, [userId]);
        const summary = await data_source_1.default.query(`SELECT
         COUNT(*) AS total_trades,
         SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
             CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
         ) AS total_pnl,
         COUNT(DISTINCT ts.symbol) AS unique_symbols
       FROM trade_signals ts
       INNER JOIN trade_signals_status tss ON tss.signal_id = ts.id
       WHERE ts.user_id = $1
         AND tss.status IN ('completed', 'closed', 'executed')
         ${dateFilter}`, [userId]);
        const s = summary[0] ?? {};
        res.json({
            data: {
                summary: {
                    totalTrades: Number(s.total_trades ?? 0),
                    totalPnl: Number(s.total_pnl ?? 0),
                    uniqueSymbols: Number(s.unique_symbols ?? 0),
                    period,
                },
                daily: daily.map((r) => ({
                    date: r.day,
                    pnl: Number(r.pnl ?? 0),
                    trades: Number(r.trades ?? 0),
                    symbol: r.symbol,
                })),
            },
        });
    }
}
exports.TradeController = TradeController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getAllTrades", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getSingleTrade", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getTradeHistory", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "closeTrade", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "listTradeAlerts", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "markTradeAlertRead", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "markAllTradeAlertsRead", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "listAdminStrategyTrades", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getAdminStrategyTrade", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "closeAdminStrategyTrade", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getMyPnl", null);
