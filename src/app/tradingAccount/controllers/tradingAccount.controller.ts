// src/app/tradingAccount/controllers/tradingAccount.controller.ts
import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest } from "../../../middleware/auth";
import { TradingAccountService, CreateTradingAccountPayload, UpdateTradingAccountPayload } from "../services/tradingAccount.service";

export class TradingAccountController {
  private service = new TradingAccountService();

  private asObject(value: unknown): Record<string, any> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return { ...(value as Record<string, any>) };
  }

  private firstNonEmptyString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return undefined;
  }

  private normalizeIndianMarketFields(payload: CreateTradingAccountPayload) {
    const brokerCode = this.firstNonEmptyString(payload.broker)?.toUpperCase();
    const meta = this.asObject(payload.accountMeta);
    const brokerMetaKey = brokerCode ? brokerCode.toLowerCase() : "";
    const brokerMeta = brokerMetaKey ? this.asObject(meta[brokerMetaKey]) : {};

    const clientId = this.firstNonEmptyString(
      payload.clientId,
      meta.clientId,
      meta.accountId,
      meta.dhanClientId,
      brokerMeta.clientId,
      brokerMeta.accountId
    );

    const apiKey = this.firstNonEmptyString(
      payload.apiKey,
      payload.vendorCode,
      meta.apiKey,
      meta.vendorCode,
      brokerMeta.apiKey,
      brokerMeta.vendorCode
    );

    const appKey = this.firstNonEmptyString(
      payload.appKey,
      payload.apiSecret,
      meta.appKey,
      meta.apiSecret,
      brokerMeta.appKey,
      brokerMeta.apiSecret
    );

    if (clientId) {
      meta.clientId = clientId;
      if (!meta.accountId) meta.accountId = clientId;
      if (!meta.dhanClientId) meta.dhanClientId = clientId;
    }

    if (apiKey) {
      meta.apiKey = apiKey;
      if (!meta.vendorCode) meta.vendorCode = apiKey;
    }

    if (appKey) {
      meta.appKey = appKey;
      if (!meta.apiSecret) meta.apiSecret = appKey;
    }

    if (brokerMetaKey) {
      const nextBrokerMeta = { ...brokerMeta };

      if (clientId) {
        nextBrokerMeta.clientId = clientId;
        if (!nextBrokerMeta.accountId) nextBrokerMeta.accountId = clientId;
      }

      if (apiKey) {
        nextBrokerMeta.apiKey = apiKey;
        if (!nextBrokerMeta.vendorCode) nextBrokerMeta.vendorCode = apiKey;
      }

      if (appKey) {
        nextBrokerMeta.appKey = appKey;
        if (!nextBrokerMeta.apiSecret) nextBrokerMeta.apiSecret = appKey;
      }

      if (Object.keys(nextBrokerMeta).length > 0) {
        meta[brokerMetaKey] = nextBrokerMeta;
      }
    }

    payload.accountMeta = meta;

    if (!payload.accountId && clientId) {
      payload.accountId = clientId;
    }
  }

  private normalizeCoinDCXFields(payload: CreateTradingAccountPayload) {
    const brokerCode = this.firstNonEmptyString(payload.broker)?.toUpperCase();
    if (brokerCode !== "COINDCX") return;

    const meta = this.asObject(payload.accountMeta);
    const coindcxMeta = this.asObject(meta.coindcx);

    const apiKey = this.firstNonEmptyString(payload.apiKey, meta.apiKey, coindcxMeta.apiKey);
    const apiSecret = this.firstNonEmptyString(payload.apiSecret, payload.appKey, meta.apiSecret, coindcxMeta.apiSecret);
    const baseUrl = this.firstNonEmptyString(
      meta.baseUrl,
      coindcxMeta.baseUrl,
      process.env.COINDCX_BASE_URL,
      "https://api.coindcx.com"
    );

    meta.coindcx = {
      ...coindcxMeta,
      ...(apiKey ? { apiKey } : {}),
      ...(apiSecret ? { apiSecret } : {}),
      ...(baseUrl ? { baseUrl } : {}),
      updatedAt: new Date().toISOString(),
    };

    payload.accountMeta = meta;

    if (!payload.accountId) {
      const accountId = this.firstNonEmptyString(meta.accountId, coindcxMeta.accountId);
      if (accountId) payload.accountId = accountId;
    }
  }

  /** GET /trading-accounts/me — all accounts for the current user, no planId required */
  @ControllerError()
  async listMyAccountsMe(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accounts = await this.service.listAllMyAccounts(userId);

    // Shape each account into the flat payload the frontend expects
    const rows = accounts.map((a: any) => ({
      id: a.id,
      market: a.broker?.marketCategory ?? null,
      broker: a.broker?.code ?? null,
      forexPlatform: a.broker?.platform ?? null,
      label: a.accountLabel ?? null,
      accountLabel: a.accountLabel ?? null,
      externalAccountId: a.accountId ?? null,
      status: a.status ?? "pending",
      lastVerifiedAt: a.lastVerifiedAt ?? null,
      last_verified_at: a.lastVerifiedAt ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    res.json({ data: rows });
  }

  /** GET /trading-accounts/:id/poll-key — returns the MT5 poll key for a specific account */
  @ControllerError()
  async getMt5PollKey(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accountId = Number(req.params.id);
    if (!accountId) { res.status(400).json({ message: "missing_account_id" }); return; }

    const account = await this.service.getMyAccountById(userId, accountId);
    const pollKey = (account as any).mt5PollKey ?? null;
    if (!pollKey) {
      res.status(404).json({ message: "poll_key_not_set" });
      return;
    }
    res.json({ data: { pollKey, accountId: (account as any).accountId } });
  }

  @ControllerError()
  async listMyAccounts(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const planIdRaw = req.query.planId as string | undefined;
    if(planIdRaw === undefined || planIdRaw === null || planIdRaw.trim() === "") {
      res.status(400).json({ message: "missing_plan_id" });
      return;
    }
    const planId = Number(planIdRaw);
    if (!Number.isFinite(planId) || planId <= 0) {
      res.status(400).json({ message: "invalid_plan_id" });
      return;
    }
    const accounts = await this.service.listMyAccounts(userId, planId);
    res.json({ accounts });
  }

  @ControllerError()
  async getMyAccountById(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accountId = Number(req.params.id);

    if (!accountId) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }

    const account = await this.service.getMyAccountById(userId, accountId);
    res.json({ account });
  }

  @ControllerError()
  async createMyAccount(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const payload: CreateTradingAccountPayload = req.body ?? {};
    console.log("Received request to create trading account with payload", { userId, payload }); 
    if (!payload.accountLabel) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    this.normalizeIndianMarketFields(payload);
    this.normalizeCoinDCXFields(payload);

    const account = await this.service.createMyAccount(userId, payload);
    res.status(201).json({ account });
  }

  @ControllerError()
  async updateMyAccount(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accountId = Number(req.params.id);
    const payload: UpdateTradingAccountPayload = req.body ?? {};

    if (!accountId) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }

    const account = await this.service.updateMyAccount(userId, accountId, payload);
    res.json({ account });
  }

  @ControllerError()
  async deleteMyAccount(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const accountId = Number(req.params.id);

    if (!accountId) {
      res.status(400).json({ message: "missing_account_id" });
      return;
    }

    await this.service.deleteMyAccount(userId, accountId);
    res.status(204).send();
  }

  // @ControllerError()
  // async allowCopyTrading(req: AuthRequest, res: Response) {
  //   const userId = Number(req.auth!.userId);
  //   const payload: { allow: boolean, userTradingAccountId: number, masterAccountId: number } = req.body ?? {};

  //   if (payload.allow === undefined) {
  //     res.status(400).json({ message: "missing_allow_field" });
  //     return;
  //   }

  //   // await this.service.setCopyTradingPermission(userId, payload.allow);
  //   res.json({ message: `you allowed copy trading ${payload.allow} for userTradingAccountId ${payload.userTradingAccountId} and masterAccountId ${payload.masterAccountId}` });
  // }

  // @ControllerError()
  // async handleCopyTradingRequest(req: AuthRequest, res: Response) {
  //   const userId = Number(req.auth!.userId);
  //   const payload: { userTradingAccountId: number, userEmail: string, masterAccountId: number } = req.body ?? {};

  //     if (!payload.userTradingAccountId || !payload.userEmail || !payload.masterAccountId) {
  //       res.status(400).json({ message: "missing_required_fields" });
  //       return;
  //     }
  //   // await this.service.handleCopyTradingRequest(userId, payload.requestId, payload.accept);
  //   res.json({ message: `you handled copy trading request for userTradingAccountId ${payload.userTradingAccountId} and masterAccountId ${payload.masterAccountId}` });
  // }

  @ControllerError()
  async getCopyTradingRequests(req: AuthRequest, res: Response) {
    console.log("Received request to get copy trading requests", { userId: req.auth!.userId });
    const userId = Number(req.auth!.userId);
    let {count, start} = req.query ?? {};
    if(count === undefined) {
      count = '10';
    }
    if(start === undefined) {
      start = '0';
    }



    const requests = await this.service.getCopyTradingRequests(userId);
    res.json({ requests });

  }

  @ControllerError()
  async handleCopyTradingRequest(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const payload: {
       userTradingAccountId: number, 
       userEmail: string } = req.body ?? {};

    if ( !payload.userTradingAccountId || !payload.userEmail) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    await this.service.makingCopyTradingRequestToMasterFromFollower({userId, userTradingAccountId: payload.userTradingAccountId, userEmail: payload.userEmail});
    res.json({ message: `you made copy trading request from userTradingAccountId ${payload.userTradingAccountId}` });
  }

  @ControllerError()
  async allowCopyTrading(req: AuthRequest, res: Response) {
    const payload: { requestId: number, approve: boolean } = req.body ?? {};

    if (!payload.requestId || payload.approve === undefined) {
      res.status(400).json({ message: "missing_required_fields" });
      return;
    }

    await this.service.approveCopyTradingRequestFromFollower(payload.requestId, payload.approve);
    res.json({ message: `you ${payload.approve ? 'approved' : 'rejected'} copy trading request ${payload.requestId}` });
  }

}
