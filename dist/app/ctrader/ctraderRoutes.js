"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const data_source_1 = __importDefault(require("../../db/data-source"));
const CTraderSession_1 = require("../../entity/CTraderSession");
const CTraderSymbol_1 = require("../../entity/CTraderSymbol");
const cTrader_1 = require("../cTraderListener/controller/cTrader");
const ctraderRouter = (0, express_1.Router)();
const controller = new cTrader_1.CTraderController();
const getSessionRepo = () => data_source_1.default.getRepository(CTraderSession_1.CTraderSession);
const getSymbolRepo = () => data_source_1.default.getRepository(CTraderSymbol_1.CTraderSymbol);
// ============ OAuth endpoints ============
ctraderRouter.post("/oauth/exchange", controller.generateTokens.bind(controller));
ctraderRouter.get("/callback", controller.oauthCallback.bind(controller));
// ============ Session endpoints ============
// GET /ctrader/session/:userId
ctraderRouter.get("/session/:userId", async (req, res, next) => {
    try {
        const { userId } = req.params;
        const session = await getSessionRepo().findOne({ where: { userId } });
        if (!session)
            return res.status(404).json({ error: "Not found" });
        res.json({
            session: {
                userId: session.userId,
                env: session.env,
                activeAccountId: session.activeAccountId,
                accessTokenEnc: session.accessTokenEnc,
                refreshTokenEnc: session.refreshTokenEnc,
                updatedAt: session.updatedAt.getTime(),
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /ctrader/session/:userId
ctraderRouter.patch("/session/:userId", async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { patch, ttlSeconds } = req.body;
        let session = await getSessionRepo().findOne({ where: { userId } });
        if (!session) {
            session = getSessionRepo().create({ userId });
        }
        // Patch fields
        if (patch.env !== undefined)
            session.env = patch.env;
        if (patch.activeAccountId !== undefined)
            session.activeAccountId = patch.activeAccountId;
        if (patch.accessTokenEnc !== undefined)
            session.accessTokenEnc = patch.accessTokenEnc;
        if (patch.refreshTokenEnc !== undefined)
            session.refreshTokenEnc = patch.refreshTokenEnc;
        // Set expiry if TTL provided
        if (ttlSeconds && ttlSeconds > 0) {
            session.expiresAt = new Date(Date.now() + ttlSeconds * 1000);
        }
        await getSessionRepo().save(session);
        res.json({
            session: {
                userId: session.userId,
                env: session.env,
                activeAccountId: session.activeAccountId,
                accessTokenEnc: session.accessTokenEnc,
                refreshTokenEnc: session.refreshTokenEnc,
                updatedAt: session.updatedAt.getTime(),
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// ============ Symbol endpoints ============
// GET /ctrader/symbols/:userId/:env/:accountId/count
ctraderRouter.get("/symbols/:userId/:env/:accountId/count", async (req, res, next) => {
    try {
        const { userId, env, accountId } = req.params;
        const count = await getSymbolRepo().count({
            where: {
                userId,
                env: env,
                accountId: Number(accountId),
            },
        });
        res.json({ count });
    }
    catch (err) {
        next(err);
    }
});
// GET /ctrader/symbols/:userId/:env/:accountId/id
ctraderRouter.get("/symbols/:userId/:env/:accountId/id", async (req, res, next) => {
    try {
        const { userId, env, accountId } = req.params;
        const { symbol } = req.query;
        if (!symbol)
            return res.status(400).json({ error: "symbol query param required" });
        const record = await getSymbolRepo().findOne({
            where: {
                userId,
                env: env,
                accountId: Number(accountId),
                symbolName: String(symbol).toUpperCase(),
            },
        });
        res.json({ symbolId: record?.symbolId ?? null });
    }
    catch (err) {
        next(err);
    }
});
// PUT /ctrader/symbols/:userId/:env/:accountId
ctraderRouter.put("/symbols/:userId/:env/:accountId", async (req, res, next) => {
    try {
        const { userId, env, accountId } = req.params;
        const { items, ttlSeconds } = req.body;
        const symbolRepo = getSymbolRepo();
        // Delete old symbols for this user/env/account
        await symbolRepo.delete({
            userId,
            env: env,
            accountId: Number(accountId),
        });
        // Insert new symbols
        if (items && Array.isArray(items) && items.length > 0) {
            const records = items.map((item) => ({
                userId,
                env: env,
                accountId: Number(accountId),
                symbolName: String(item.symbol).toUpperCase(),
                symbolId: Number(item.symbolId),
                expiresAt: ttlSeconds && ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000) : null,
            }));
            await symbolRepo.insert(records);
        }
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// GET /ctrader/symbols/:userId/:env/:accountId/search
ctraderRouter.get("/symbols/:userId/:env/:accountId/search", async (req, res, next) => {
    try {
        const { userId, env, accountId } = req.params;
        const { q, limit } = req.query;
        const query = getSymbolRepo()
            .createQueryBuilder("s")
            .where("s.userId = :userId", { userId })
            .andWhere("s.env = :env", { env })
            .andWhere("s.accountId = :accountId", { accountId: Number(accountId) });
        if (q) {
            query.andWhere("s.symbolName ILIKE :q", { q: `%${String(q).toUpperCase()}%` });
        }
        const lim = limit ? Math.min(Number(limit), 2000) : 200;
        const items = await query.limit(lim).getMany();
        res.json({
            items: items.map((s) => ({ symbol: s.symbolName, symbolId: s.symbolId })),
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = ctraderRouter;
