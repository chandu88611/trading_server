import { ActivityFeedService } from "./app/trade/services/activityFeed.service";
import { MamLinksService } from "./app/trade/services/mamLinks.service";
import { startTradeEvents } from "./app/trade/services/tradeEvents.service";
import { ReconciliationService } from "./app/trade/services/reconciliation.service";
import { EmergencyHaltService } from "./app/trade/services/emergencyHalt.service";
import "reflect-metadata";
import express, { Application, NextFunction, Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import AppDataSource, { ensureAppDataSourceInitialized } from "./db/data-source";
import { initKite } from "./kite";
import validateSchema from "./db/validateSchema";
import { ApplicationRouter } from "./app/routes";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getTradingOpenApi } from "./docs/openapi";
import { CrmLifecycleSyncService } from "./app/integrations/crm/services/crmLifecycleSync.service";
import { SupportTicketService } from "./app/support/services/supportTicket.service";
import { StrategyService } from "./app/strategy/strategy";
import { SubscriptionPlanService } from "./app/subscriptionPlan/services/subscriptionPlan";
import { UserSubscriptionService } from "./app/userSubscription/services/userSubscription";
import { UserService } from "./app/user/services/user.service";
import { BillingDBService } from "./app/billing/services/billing.db";
import { AlertSnapshotDB } from "./app/broker/brokerAlerts/services/alertSnapshot.db";
import { TradeAlertDBService } from "./app/trade/services/tradeAlert.db";
import { CTraderService } from "./app/cTraderListener/services/cTrader";
import { Mt5ListenerServices } from "./app/mt5Listener/mt5Listener.services";
import { Mt5ListenerDBServices } from "./app/mt5Listener/mt5Listener.db";
import { getJwtSecret } from "./middleware/auth";
import { AdminService } from "./app/admin/admin.service";
import { CopyExecutionService } from "./app/copyExecution/copyExecution.service";
import { BrokerInstrumentService } from "./app/india/options/brokerInstrument.service";

dotenv.config();

const DEFAULT_JSON_LIMIT = "100kb";
const CTRADER_SYMBOL_CACHE_JSON_LIMIT = "5mb";

function captureRawBody(req: any, _res: Response, buf: Buffer) {
  if (
    req.originalUrl?.startsWith("/billing/razorpay/webhook") ||
    req.originalUrl?.startsWith("/billing/razorpayx/webhook")
  ) {
    req.rawBody = buf;
  }
}

function isPayloadTooLargeError(err: unknown): err is {
  status?: number;
  statusCode?: number;
  type?: string;
} {
  const anyErr = err as any;
  return (
    anyErr?.type === "entity.too.large" ||
    Number(anyErr?.status) === 413 ||
    Number(anyErr?.statusCode) === 413
  );
}

function isCTraderSymbolReplaceRequest(req: Request): boolean {
  const path = String(req.originalUrl ?? req.path ?? "").split("?")[0];
  return (
    req.method.toUpperCase() === "PUT" &&
    /^\/ctrader\/symbols\/[^/]+\/(?:demo|live)\/[^/]+$/.test(path)
  );
}

function isMt5StateSyncRequest(req: Request): boolean {
  const path = String(req.originalUrl ?? req.path ?? "").split("?")[0];
  return req.method.toUpperCase() === "POST" && path === "/signal/state";
}

export default class Server {
  private static backgroundWorkersStarted = false;
  private app: Application;
  private port: number;
  private crmSyncService: CrmLifecycleSyncService;
  private supportTicketService: SupportTicketService;
  private strategyService: StrategyService;
  private subscriptionPlanService: SubscriptionPlanService;
  private userSubscriptionService: UserSubscriptionService;
  private userService: UserService;
  private billingDb: BillingDBService;
  private alertSnapshotDB: AlertSnapshotDB;
  private tradeAlertDB: TradeAlertDBService;
  private cTraderService: CTraderService;
  private mt5ListenerService: Mt5ListenerServices;
  private adminService: AdminService;
  private copyExecutionService: CopyExecutionService;
  private brokerInstrumentService: BrokerInstrumentService;

  constructor() {
    this.app = express();
    this.port = Number(process.env.PORT) || 3000;
    this.crmSyncService = new CrmLifecycleSyncService();
    this.supportTicketService = new SupportTicketService();
    this.strategyService = new StrategyService();
    this.subscriptionPlanService = new SubscriptionPlanService();
    this.userSubscriptionService = new UserSubscriptionService();
    this.userService = new UserService();
    this.billingDb = new BillingDBService();
    this.alertSnapshotDB = new AlertSnapshotDB();
    this.tradeAlertDB = new TradeAlertDBService();
    this.cTraderService = new CTraderService();
    this.mt5ListenerService = new Mt5ListenerServices(new Mt5ListenerDBServices(AppDataSource));
    this.adminService = new AdminService();
    this.copyExecutionService = new CopyExecutionService();
    this.brokerInstrumentService = new BrokerInstrumentService();

    this.config();
    this.routes();
  }

  private async bootstrapBackgroundWorkers() {
    if (Server.backgroundWorkersStarted) {
      return;
    }

    await Promise.all([
      import("./cron/ctrader-exec.worker"),
      import("./cron/dhan-exec.worker"),
      import("./cron/zebu-exec.worker"),
      import("./cron/coindcx-exec.worker"),
      import("./cron/crm-sync.cron"),
      import("./cron/stale-jobs.worker"),
      import("./cron/emergency-halt.worker"),
      import("./cron/reconciliation.worker"),
      import("./cron/coindcx-stream.worker"),
      import("./cron/spot-protection.worker"),
      import("./cron/delta-exec.worker"),
      import("./cron/zebu-instrument-sync.cron"),
    ]);

    Server.backgroundWorkersStarted = true;
  }

  private config() {
    const allowedOrigins = [
      process.env.FRONTEND_ORIGIN || "",
      "http://localhost:5173",
      "http://localhost:5175",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://globalalgotrading.com",
      "https://tradebro.io",
      "https://admin.tradebro.io"
    ].filter(Boolean);

    this.app.use(
      cors({
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.includes(origin)) return cb(null, true);
          return cb(new Error("CORS blocked"), false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Poll-Key"],
      })
    );

    this.app.use(cookieParser());
    this.app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  }

  private routes() {
    this.app.put(
      "/ctrader/symbols/:userId/:env/:accountId",
      express.json({
        limit: CTRADER_SYMBOL_CACHE_JSON_LIMIT,
        verify: captureRawBody,
      }),
      (_req, _res, next) => next()
    );
    this.app.post(
      "/signal/state",
      express.json({
        limit: CTRADER_SYMBOL_CACHE_JSON_LIMIT,
        verify: captureRawBody,
      }),
      (_req, _res, next) => next()
    );

    this.app.use(
      express.json({
        limit: DEFAULT_JSON_LIMIT,
        verify: captureRawBody,
      })
    );
    this.app.use(express.urlencoded({ extended: true, limit: DEFAULT_JSON_LIMIT }));

    this.app.use("/", new ApplicationRouter().getRouter());

    this.app.get("/health", (_, res) => res.send("OK"));
    this.app.get("/api/openapi.json", (_req, res) => {
      res.status(200).json(getTradingOpenApi());
    });
    this.app.get("/api/docs", (_req, res) => {
      res
        .status(200)
        .send(`<!doctype html><html><head><title>Trading Service Docs</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:1000px;margin:0 auto}pre{white-space:pre-wrap;background:#111827;color:#f9fafb;padding:16px;border-radius:8px}</style></head><body><h1>Trading Service Docs</h1><p>OpenAPI JSON: <a href="/api/openapi.json">/api/openapi.json</a></p><pre>${JSON.stringify(
          getTradingOpenApi(),
          null,
          2
        )}</pre></body></html>`);
    });

    // this.app.get("/ctrader/auth", (_req, res) => {
    //   if (
    //     !CTRADER_CLIENT_ID ||
    //     !CTRADER_CLIENT_SECRET ||
    //     !CTRADER_REDIRECT_URI
    //   ) {
    //     return res.status(500).json({
    //       ok: false,
    //       message:
    //         "Missing CTRADER_CLIENT_ID / CTRADER_CLIENT_SECRET / CTRADER_REDIRECT_URI in env",
    //     });
    //   }

    //   const url = new URL(GRANT_URL);
    //   url.searchParams.set("client_id", CTRADER_CLIENT_ID);
    //   url.searchParams.set("redirect_uri", CTRADER_REDIRECT_URI);
    //   url.searchParams.set("scope", "trading");
    //   url.searchParams.set("product", "web");

    //   return res.redirect(url.toString());
    // });

    // this.app.get("/ctrader/callback", async (req, res) => {
    //   try {
    //     const code = String(req.query.code || "");
    //     if (!code) return res.status(400).send("Missing ?code");

    //     const tokenResp = await axios.get(TOKEN_URL, {
    //       params: {
    //         grant_type: "authorization_code",
    //         code,
    //         redirect_uri: CTRADER_REDIRECT_URI,
    //         client_id: CTRADER_CLIENT_ID,
    //         client_secret: CTRADER_CLIENT_SECRET,
    //       },
    //       timeout: 20000,
    //     });

    //     const token: any = tokenResp.data;
    //     console.log("[cTrader][TOKEN]", token,req.query);

    //     this.startOpenApiSession({
    //       accessToken: token.accessToken,
    //       preferredEnv: CTRADER_ENV,
    //     })
    //       .then(() => console.log("[cTrader][DONE] WS flow finished"))
    //       .catch((e) =>
    //         console.error("[cTrader][WS FLOW ERROR]", e?.message || e)
    //       );

    //     return res.json({
    //       ok: true,
    //       tokenType: token.tokenType,
    //       expiresIn: token.expiresIn,
    //       accessTokenPreview:
    //         String(token.accessToken || "").slice(0, 10) + "...",
    //       note: "Check server logs for WS auth + account list + trader info.",
    //     });
    //   } catch (e: any) {
    //     console.error("[cTrader][TOKEN ERROR]", e?.response?.data || e);
    //     return res.status(500).send("Token exchange failed. Check logs.");
    //   }
    // });

    this.app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
      if (!isPayloadTooLargeError(err)) {
        next(err);
        return;
      }

      const route = isCTraderSymbolReplaceRequest(req)
        ? "ctrader_symbols_replace"
        : isMt5StateSyncRequest(req)
          ? "mt5_symbol_state"
        : "request_body";
      res.status(413).json({ error: "payload_too_large", route });
    });
  }

  public async start() {
    try {
      getJwtSecret();
      await ensureAppDataSourceInitialized();
      await this.crmSyncService.ensureSchema();
      await this.supportTicketService.ensureSchema();
      await this.userService.ensureSchema();
      await this.userSubscriptionService.ensureSchema();
      await this.subscriptionPlanService.ensureSchema();
      await this.billingDb.ensureSchema();
      await this.strategyService.ensureSchema();
      await this.alertSnapshotDB.ensureSchema();
      await this.tradeAlertDB.ensureSchema();
      await this.cTraderService.ensureSchema();
      await this.mt5ListenerService.ensureSchema();
      await this.adminService.ensureSchema();
      await this.copyExecutionService.ensureSchema();
      await this.brokerInstrumentService.ensureSchema();
      await new MamLinksService().ensureSchema();
      await new EmergencyHaltService().ensureSchema();
      await new ReconciliationService().ensureSchema();
      await new ActivityFeedService().ensureSchema();
      await startTradeEvents();

      const enableSchemaValidation =
        String(process.env.ENABLE_SCHEMA_VALIDATION || "").toLowerCase() ===
        "true";
      if (enableSchemaValidation) {
        await validateSchema(AppDataSource);
      }
      await this.bootstrapBackgroundWorkers();
      initKite().catch(console.error);

      this.app.listen(this.port, () => {
        console.log(`🚀 Server running on ${this.port}`);
      });
    } catch (e) {
      console.error("Server start failed", e);
      setTimeout(() => this.start(), 5000);
    }
  }
}
