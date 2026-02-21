import type { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { CTraderService } from "../services/cTrader";

export class CTraderController {
  private service: CTraderService;

  constructor() {
    this.service = new CTraderService();
  }

  private parsePositiveInt(value: unknown): number | null {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }

  @ControllerError()
  async generateTokens(req: Request, res: Response) {
    try {
      const code = String((req.body as any)?.code ?? "").trim();
      const accountIdRaw = (req.body as any)?.accountId ?? (req.body as any)?.account_id;
      const accountId = this.parsePositiveInt(accountIdRaw);

      if (!code) {
        return res.status(400).json({ error: "code_required" });
      }
      if (!accountId) {
        return res.status(400).json({ error: "accountId_required" });
      }

      const result = await this.service.completeOAuthAndVerifyByCTraderAccountId(String(accountId), code);
      if (!result.ok) {
        return res.status(result.status ?? 502).json({
          error: "ctrader_oauth_exchange_failed",
          details: result.details ?? result.error,
        });
      }

      return res.status(200).json({
        message: "cTrader connected",
        data: {
          accountId,
          userId: result.userId,
          rowId: result.rowId,
          ctraderAccountId: result.ctraderAccountId,
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
      const code = String((req.query as any)?.code ?? "").trim();
      const state = String((req.query as any)?.state ?? "").trim();

      if (!code) return res.status(400).json({ error: "code_required" });
      if (!state) return res.status(400).json({ error: "state_required" });

      const accountId = this.parsePositiveInt(state);
      if (!accountId) {
        return res.status(400).json({ error: "invalid_state_accountId" });
      }

      const result = await this.service.completeOAuthAndVerifyByCTraderAccountId(state, code);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error, details: result.details });
      }
      // return res.status(200).json({
      //   message: "cTrader OAuth callback processed",
      //   data: {
      //     accountId,
      //     userId: result.userId,
      //     rowId: result.rowId,
      //     ctraderAccountId: result.ctraderAccountId,
      //   },
      // });
      // redirect to https://tradebro.io/profile
      return res.redirect("https://tradebro.io/profile");
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to handle OAuth callback",
        details: error?.message ?? String(error),
      });
    }
  }
}
