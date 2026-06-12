import { Router } from "express";
import AppDataSource from "../../db/data-source";
import { CTraderSession } from "../../entity/CTraderSession";
import { CTraderSymbol } from "../../entity/CTraderSymbol";
import { CTraderTrailingTakeProfitMonitor } from "../../entity/CTraderTrailingTakeProfitMonitor";
import { TradeSignalStatus } from "../../entity/TradeSignalsStatus";
import { CTraderController } from "../cTraderListener/controller/cTrader";
import { requireAuth, Roles } from "../../middleware/auth";

const ctraderRouter = Router();
const controller = new CTraderController();

// Authenticated (user JWT): account funds/balance via gateway PROTO_OA_TRADER_RES.
ctraderRouter.get(
  "/funds",
  requireAuth([Roles.USER, Roles.ADMIN]),
  controller.getFunds.bind(controller)
);

const getSessionRepo = () => AppDataSource.getRepository(CTraderSession);
const getSymbolRepo = () => AppDataSource.getRepository(CTraderSymbol);
const getMonitorRepo = () => AppDataSource.getRepository(CTraderTrailingTakeProfitMonitor);
const getTradeSignalStatusRepo = () => AppDataSource.getRepository(TradeSignalStatus);

function ensureInternalApiKey(req: any, res: any) {
  const expected = String(process.env.INTERNAL_API_KEY ?? "").trim();
  if (!expected) return true;
  const provided = String(req.headers["x-internal-api-key"] ?? "").trim();
  if (provided === expected) return true;
  res.status(401).json({ error: "UNAUTHORIZED" });
  return false;
}

// ============ OAuth endpoints ============

ctraderRouter.post(
  "/oauth/exchange",
  controller.generateTokens.bind(controller)
);

ctraderRouter.get(
  "/callback",
  controller.oauthCallback.bind(controller)
);

// ============ Session endpoints ============

// GET /ctrader/session/:userId
ctraderRouter.get("/session/:userId", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const { userId } = req.params;
    const session = await getSessionRepo().findOne({ where: { userId } });

    if (!session) return res.status(404).json({ error: "Not found" });

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
  } catch (err) {
    next(err);
  }
});

// PATCH /ctrader/session/:userId
ctraderRouter.patch("/session/:userId", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const { userId } = req.params;
    const { patch, ttlSeconds } = req.body;

    let session = await getSessionRepo().findOne({ where: { userId } });

    if (!session) {
      session = getSessionRepo().create({ userId });
    }

    // Patch fields
    if (patch.env !== undefined) session.env = patch.env;
    if (patch.activeAccountId !== undefined) session.activeAccountId = patch.activeAccountId;
    if (patch.accessTokenEnc !== undefined) session.accessTokenEnc = patch.accessTokenEnc;
    if (patch.refreshTokenEnc !== undefined) session.refreshTokenEnc = patch.refreshTokenEnc;

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
  } catch (err) {
    next(err);
  }
});

// ============ Symbol endpoints ============

// GET /ctrader/symbols/:userId/:env/:accountId/count
ctraderRouter.get("/symbols/:userId/:env/:accountId/count", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const { userId, env, accountId } = req.params;
    const count = await getSymbolRepo().count({
      where: {
        userId,
        env: env as "demo" | "live",
        accountId: Number(accountId),
      },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// GET /ctrader/symbols/:userId/:env/:accountId/id
ctraderRouter.get("/symbols/:userId/:env/:accountId/id", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const { userId, env, accountId } = req.params;
    const { symbol } = req.query;

    if (!symbol) return res.status(400).json({ error: "symbol query param required" });

    const record = await getSymbolRepo().findOne({
      where: {
        userId,
        env: env as "demo" | "live",
        accountId: Number(accountId),
        symbolName: String(symbol).toUpperCase(),
      },
    });

    res.json({ symbolId: record?.symbolId ?? null });
  } catch (err) {
    next(err);
  }
});

ctraderRouter.get("/symbols/:userId/:env/:accountId/meta", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const { userId, env, accountId } = req.params;
    const { symbol } = req.query;

    if (!symbol) return res.status(400).json({ error: "symbol query param required" });

    const record = await getSymbolRepo().findOne({
      where: {
        userId,
        env: env as "demo" | "live",
        accountId: Number(accountId),
        symbolName: String(symbol).toUpperCase(),
      },
    });

    if (!record) {
      return res.status(404).json({ error: "not_found" });
    }

    res.json({
      symbolId: record.symbolId,
      lotSize: record.lotSize,
      digits: record.digits,
      pipPosition: record.pipPosition,
      slDistance: record.slDistance,
      tpDistance: record.tpDistance,
      distanceSetIn: record.distanceSetIn,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /ctrader/symbols/:userId/:env/:accountId
ctraderRouter.put("/symbols/:userId/:env/:accountId", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const { userId, env, accountId } = req.params;
    const { items, ttlSeconds } = req.body;

    const symbolRepo = getSymbolRepo();

    // Delete old symbols for this user/env/account
    await symbolRepo.delete({
      userId,
      env: env as "demo" | "live",
      accountId: Number(accountId),
    });

    // Insert new symbols
    if (items && Array.isArray(items) && items.length > 0) {
      const records = items.map((item: any) => ({
        userId,
        env: env as "demo" | "live",
        accountId: Number(accountId),
        symbolName: String(item.symbol ?? item.symbol_name).toUpperCase(),
        symbolId: Number(item.symbolId ?? item.symbol_id),
        lotSize:
          item.lotSize === undefined || item.lotSize === null
            ? item.lot_size === undefined || item.lot_size === null
              ? null
              : String(item.lot_size)
            : String(item.lotSize),
        digits:
          item.digits === undefined || item.digits === null
            ? item.digits_raw === undefined || item.digits_raw === null
              ? null
              : Number(item.digits_raw)
            : Number(item.digits),
        pipPosition:
          item.pipPosition === undefined || item.pipPosition === null
            ? item.pip_position === undefined || item.pip_position === null
              ? null
              : Number(item.pip_position)
            : Number(item.pipPosition),
        slDistance:
          item.slDistance === undefined || item.slDistance === null
            ? item.sl_distance === undefined || item.sl_distance === null
              ? null
              : Number(item.sl_distance)
            : Number(item.slDistance),
        tpDistance:
          item.tpDistance === undefined || item.tpDistance === null
            ? item.tp_distance === undefined || item.tp_distance === null
              ? null
              : Number(item.tp_distance)
            : Number(item.tpDistance),
        distanceSetIn:
          item.distanceSetIn === undefined || item.distanceSetIn === null
            ? item.distance_set_in === undefined || item.distance_set_in === null
              ? null
              : String(item.distance_set_in)
            : String(item.distanceSetIn),
        expiresAt: ttlSeconds && ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000) : null,
      }));
      await symbolRepo.insert(records);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /ctrader/symbols/:userId/:env/:accountId/search
ctraderRouter.get("/symbols/:userId/:env/:accountId/search", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
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
  } catch (err) {
    next(err);
  }
});

ctraderRouter.get("/trailing-tp-monitors/active", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const items = await getMonitorRepo()
      .createQueryBuilder("monitor")
      .where("monitor.monitor_status IN (:...statuses)", {
        statuses: ["pending_fill", "active", "closing"],
      })
      .orderBy("monitor.updated_at", "DESC")
      .getMany();

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

ctraderRouter.get("/trailing-tp-monitors/by-trade-signal/:tradeSignalId", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const tradeSignalId = Number(req.params.tradeSignalId);
    if (!Number.isFinite(tradeSignalId) || tradeSignalId <= 0) {
      return res.status(400).json({ error: "invalid_tradeSignalId" });
    }

    const monitor = await getMonitorRepo().findOne({ where: { tradeSignalId } });
    if (!monitor) {
      return res.status(404).json({ error: "not_found" });
    }

    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

ctraderRouter.put("/trailing-tp-monitors/by-trade-signal/:tradeSignalId", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const tradeSignalId = Number(req.params.tradeSignalId);
    if (!Number.isFinite(tradeSignalId) || tradeSignalId <= 0) {
      return res.status(400).json({ error: "invalid_tradeSignalId" });
    }

    const repo = getMonitorRepo();
    const existing = await repo.findOne({ where: { tradeSignalId } });
    const next = repo.create({
      ...(existing ?? {}),
      ...req.body,
      tradeSignalId,
    });
    const monitor = await repo.save(next);
    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

ctraderRouter.patch("/trailing-tp-monitors/by-trade-signal/:tradeSignalId", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const tradeSignalId = Number(req.params.tradeSignalId);
    if (!Number.isFinite(tradeSignalId) || tradeSignalId <= 0) {
      return res.status(400).json({ error: "invalid_tradeSignalId" });
    }

    const repo = getMonitorRepo();
    const existing = await repo.findOne({ where: { tradeSignalId } });
    if (!existing) {
      return res.status(404).json({ error: "not_found" });
    }

    Object.assign(existing, req.body ?? {});
    const monitor = await repo.save(existing);
    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

ctraderRouter.post("/trailing-tp-monitors/:tradeSignalId/mark-closed", async (req, res, next) => {
  try {
    if (!ensureInternalApiKey(req, res)) return;
    const tradeSignalId = Number(req.params.tradeSignalId);
    if (!Number.isFinite(tradeSignalId) || tradeSignalId <= 0) {
      return res.status(400).json({ error: "invalid_tradeSignalId" });
    }

    await getTradeSignalStatusRepo()
      .createQueryBuilder()
      .update(TradeSignalStatus)
      .set({ status: "closed", updatedAt: new Date() })
      .where("tradeSignalId = :tradeSignalId", { tradeSignalId })
      .execute();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default ctraderRouter;
