import { Router, Response } from "express";
import { requireAuth, AuthRequest, Roles } from "../../middleware/auth";
import { ZebuService } from "../zebu/services/zebu.service";
import { UpstoxService } from "../upstox/services/upstox.service";
import AppDataSource from "../../db/data-source";
import { UserTradingAccount } from "../../entity/UserTradingAccount";

const router = Router();
const zebu = new ZebuService();
const upstox = new UpstoxService();

function requireUserId(req: AuthRequest): number {
  const id = Number(req.auth?.userId);
  if (!id) throw { statusCode: 400, message: "user_id_required" };
  return id;
}

async function resolveAccount(userId: number, tradingAccountId: number, brokerCode?: string) {
  const acc = await AppDataSource.getRepository(UserTradingAccount).findOne({
    where: { id: tradingAccountId, userId },
    relations: ["broker"],
  });

  if (!acc) throw { statusCode: 404, message: "trading_account_not_found" };

  if (brokerCode) {
    const actualBrokerCode = String(acc.broker?.code ?? "").toUpperCase();
    if (actualBrokerCode !== brokerCode.toUpperCase()) {
      throw {
        statusCode: 400,
        message: "invalid_broker_for_trading_account",
        data: {
          expected: brokerCode.toUpperCase(),
          actual: actualBrokerCode,
        },
      };
    }
  }

  return acc;
}

/**
 * POST /india/token-requests
 * Existing Zebu TOTP token generation.
 * Body: { tradingAccountId, password, factor2 }
 */
router.post(
  "/token-requests",
  requireAuth([Roles.USER, Roles.ADMIN]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = requireUserId(req);
      const { tradingAccountId, password, factor2 } = req.body ?? {};

      if (!tradingAccountId) {
        res.status(400).json({ message: "tradingAccountId_required" });
        return;
      }

      if (!password) {
        res.status(400).json({ message: "password_required" });
        return;
      }

      if (!factor2) {
        res.status(400).json({ message: "factor2_totp_required" });
        return;
      }

      await resolveAccount(userId, Number(tradingAccountId), "ZEBU");

      const result = await zebu.generateAndSaveTokenUsingTotp({
        userId,
        tradingAccountId: Number(tradingAccountId),
        password: String(password),
        factor2: String(factor2),
      });

      res.json({ ok: true, broker: "ZEBU", data: result });
    } catch (err: any) {
      const status = Number(err?.statusCode ?? 500);
      res.status(status).json({
        message: err?.message ?? "token_request_failed",
        data: err?.data,
      });
    }
  },
);

/**
 * POST /india/token
 * Existing Zebu manual token save.
 * Body: { tradingAccountId, accessToken, uid?, apiKey? }
 */
router.post(
  "/token",
  requireAuth([Roles.USER, Roles.ADMIN]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = requireUserId(req);
      const { tradingAccountId, accessToken, uid, apiKey } = req.body ?? {};

      if (!tradingAccountId || !accessToken) {
        res.status(400).json({ message: "tradingAccountId_and_accessToken_required" });
        return;
      }

      await resolveAccount(userId, Number(tradingAccountId), "ZEBU");

      const result = await zebu.saveAuthToken({
        userId,
        tradingAccountId: Number(tradingAccountId),
        accessToken: String(accessToken),
        uid: uid ? String(uid) : undefined,
        apiKey: apiKey ? String(apiKey) : undefined,
      });

      res.json({ ok: true, broker: "ZEBU", data: result });
    } catch (err: any) {
      const status = Number(err?.statusCode ?? 500);
      res.status(status).json({
        message: err?.message ?? "save_token_failed",
        data: err?.data,
      });
    }
  },
);

/**
 * POST /india/upstox/token-requests
 * Upstox OAuth auth-code token generation.
 *
 * Body:
 * {
 *   tradingAccountId,
 *   code,
 *   clientId,
 *   clientSecret,
 *   redirectUri
 * }
 */
router.post(
  "/upstox/token-requests",
  requireAuth([Roles.USER, Roles.ADMIN]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = requireUserId(req);
      const { tradingAccountId, code, clientId, clientSecret, redirectUri } = req.body ?? {};

      if (!tradingAccountId) {
        res.status(400).json({ message: "tradingAccountId_required" });
        return;
      }

      if (!code) {
        res.status(400).json({ message: "code_required" });
        return;
      }

      const finalClientId = String(clientId ?? process.env.UPSTOX_CLIENT_ID ?? "").trim();
      const finalClientSecret = String(clientSecret ?? process.env.UPSTOX_CLIENT_SECRET ?? "").trim();
      const finalRedirectUri = String(redirectUri ?? process.env.UPSTOX_REDIRECT_URI ?? "").trim();

      if (!finalClientId) {
        res.status(400).json({ message: "clientId_required" });
        return;
      }

      if (!finalClientSecret) {
        res.status(400).json({ message: "clientSecret_required" });
        return;
      }

      if (!finalRedirectUri) {
        res.status(400).json({ message: "redirectUri_required" });
        return;
      }

      await resolveAccount(userId, Number(tradingAccountId), "UPSTOX");

      const result = await upstox.generateAndSaveTokenUsingCode({
        userId,
        tradingAccountId: Number(tradingAccountId),
        code: String(code),
        clientId: finalClientId,
        clientSecret: finalClientSecret,
        redirectUri: finalRedirectUri,
      });

      res.json({ ok: true, broker: "UPSTOX", data: result });
    } catch (err: any) {
      const status = Number(err?.statusCode ?? 500);
      res.status(status).json({
        message: err?.message ?? "upstox_token_request_failed",
        data: err?.data,
      });
    }
  },
);

/**
 * POST /india/upstox/token
 * Upstox manual access token save.
 *
 * Body:
 * {
 *   tradingAccountId,
 *   accessToken,
 *   clientId?,
 *   apiKey?,
 *   baseUrl?
 * }
 */
router.post(
  "/upstox/token",
  requireAuth([Roles.USER, Roles.ADMIN]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = requireUserId(req);
      const { tradingAccountId, accessToken, clientId, apiKey, baseUrl } = req.body ?? {};

      if (!tradingAccountId || !accessToken) {
        res.status(400).json({ message: "tradingAccountId_and_accessToken_required" });
        return;
      }

      await resolveAccount(userId, Number(tradingAccountId), "UPSTOX");

      const result = await upstox.saveAuthToken({
        userId,
        tradingAccountId: Number(tradingAccountId),
        accessToken: String(accessToken),
        apiKey: clientId ? String(clientId) : apiKey ? String(apiKey) : undefined,
        baseUrl: baseUrl ? String(baseUrl) : undefined,
      });

      res.json({ ok: true, broker: "UPSTOX", data: result });
    } catch (err: any) {
      const status = Number(err?.statusCode ?? 500);
      res.status(status).json({
        message: err?.message ?? "upstox_save_token_failed",
        data: err?.data,
      });
    }
  },
);

export default router;
