import { Router, Response } from "express";
import { requireAuth, AuthRequest, Roles } from "../../middleware/auth";
import { ZebuService } from "../zebu/services/zebu.service";
import AppDataSource from "../../db/data-source";
import { UserTradingAccount } from "../../entity/UserTradingAccount";

const router = Router();
const zebu = new ZebuService();

function requireUserId(req: AuthRequest): number {
  const id = Number(req.auth?.userId);
  if (!id) throw { statusCode: 400, message: "user_id_required" };
  return id;
}

async function resolveAccount(userId: number, tradingAccountId: number) {
  const acc = await AppDataSource.getRepository(UserTradingAccount).findOne({
    where: { id: tradingAccountId, userId },
    relations: ["broker"],
  });
  if (!acc) throw { statusCode: 404, message: "trading_account_not_found" };
  return acc;
}

/**
 * POST /india/token-requests
 * Initiate a TOTP-based authentication request for an India (Zebu) trading account.
 * Body: { tradingAccountId, password, factor2 }
 * Returns the generated session token.
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

      await resolveAccount(userId, Number(tradingAccountId));

      const result = await zebu.generateAndSaveTokenUsingTotp({
        userId,
        tradingAccountId: Number(tradingAccountId),
        password: String(password),
        factor2: String(factor2),
      });

      res.json({ ok: true, data: result });
    } catch (err: any) {
      const status = Number(err?.statusCode ?? 500);
      res.status(status).json({ message: err?.message ?? "token_request_failed" });
    }
  },
);

/**
 * POST /india/token
 * Admin or user manually saves an access token for an India account.
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

      await resolveAccount(userId, Number(tradingAccountId));

      const result = await zebu.saveAuthToken({
        userId,
        tradingAccountId: Number(tradingAccountId),
        accessToken: String(accessToken),
        uid: uid ? String(uid) : undefined,
        apiKey: apiKey ? String(apiKey) : undefined,
      });

      res.json({ ok: true, data: result });
    } catch (err: any) {
      const status = Number(err?.statusCode ?? 500);
      res.status(status).json({ message: err?.message ?? "save_token_failed" });
    }
  },
);

export default router;
