import type { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler"; // adjust path
import { CTraderService } from "../services/cTrader";    // adjust path

export class CTraderController {
  private service: CTraderService;

  constructor() {
    this.service = new CTraderService();
  }

  @ControllerError()
  async generateTokens(req: Request, res: Response) {
    try {
    //   const userId = (req as any).auth?.userId as number;
    //   if (!userId || !Number.isFinite(Number(userId))) {
    //     return res.status(401).json({ error: "unauthorized" });
    //   }
console.log("CTraderController.generateTokens called", req.body);
      const code = String((req.body as any)?.code ?? "").trim();
      const accountIdRaw = (req.body as any)?.accountId ?? (req.body as any)?.account_id;
      const accountId = Number(accountIdRaw);

      if (!code) {
        return res.status(400).json({ error: "code_required" });
      }
      if (!Number.isFinite(accountId) || accountId <= 0) {
        return res.status(400).json({ error: "accountId_required" });
      }

      const ex = await this.service.exchangeOAuthCode(accountId, code);
      if (!ex.ok) {
        return res.status(ex.status ?? 502).json({
          error: "ctrader_oauth_exchange_failed",
          details: ex.error,
          payload: ex.payload,
        });
      }
      console.log("CTraderController.generateTokens success", { accountId, exchangePayload: ex.payload });


      return res.status(200).json({
        message: "cTrader connected",
        data: {
          exchange: ex.payload,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to generate tokens",
        details: error?.message ?? String(error),
      });
    }
  }
@ControllerError()
  async oauthCallback(req: Request, res: Response) {
    try {
      // DO NOT log req.query (contains OAuth code)
      const code = String((req.query as any)?.code ?? "").trim();
      const state = String((req.query as any)?.state ?? "").trim(); // we treat it as accountId
      console.log("cTrader OAuth callback received", { code: code ? "present" : "missing", state });

      if (!code) return res.status(400).json({ error: "code_required" });
      if (!state) return res.status(400).json({ error: "state_required" });

      // userId must come from your auth/session (cookie/JWT middleware)
    //   const userId = (req as any).auth?.userId as number;
    //   if (!userId || !Number.isFinite(Number(userId))) {
    //     return res.status(401).json({ error: "unauthorized" });
    //   }

      const accountId = Number(state);
      if (!Number.isFinite(accountId) || accountId <= 0) {
        return res.status(400).json({ error: "invalid_state_accountId" });
      }

      // 1) exchange code -> store tokens for THIS user
      const ex = await this.service.exchangeOAuthCode(state, code);
      if (!ex.ok) {
        return res.status(ex.status ?? 502).json({
          error: "ctrader_oauth_exchange_failed",
          details: ex.error,
          payload: ex.payload,
        });
      }

      // 2) authorize/switch selected accountId for THIS user
    //   const auth = await this.service.authorizeAccount(userId, accountId);
    //   if (!auth.ok) {
    //     return res.status(auth.status ?? 502).json({
    //       error: "ctrader_account_auth_failed",
    //       details: auth.error,
    //       payload: auth.payload,
    //     });
    //   }

const statee = String((req.query as any)?.state ?? "").trim(); // "5747051"
const codee = String((req.query as any)?.code ?? "").trim();

const result = await this.service.completeOAuthAndVerifyByCTraderAccountId(statee, codee);

// if (!result.ok) {
//   return res.status(result.status).json({ error: result.error, details: result.details });
// }
const next = `https://tradebro.io/forex-trading`;
  return res.redirect(302, next);
    //   return res.status(200).json({
    //     message: "cTrader connected via callback",
    //     data: {
    //       exchange: ex.payload,
    //     //   authAccount: auth.payload,
    //       accountId,
    //     },
    //   });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to handle OAuth callback",
        details: error?.message ?? String(error),
      });
    }
  }
}
