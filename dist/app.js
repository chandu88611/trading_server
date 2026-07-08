"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const data_source_1 = __importStar(require("./db/data-source"));
const kite_1 = require("./kite");
const validateSchema_1 = __importDefault(require("./db/validateSchema"));
const routes_1 = require("./app/routes");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const openapi_1 = require("./docs/openapi");
const crmLifecycleSync_service_1 = require("./app/integrations/crm/services/crmLifecycleSync.service");
const supportTicket_service_1 = require("./app/support/services/supportTicket.service");
const strategy_1 = require("./app/strategy/strategy");
const subscriptionPlan_1 = require("./app/subscriptionPlan/services/subscriptionPlan");
const userSubscription_1 = require("./app/userSubscription/services/userSubscription");
const user_service_1 = require("./app/user/services/user.service");
const billing_db_1 = require("./app/billing/services/billing.db");
const alertSnapshot_db_1 = require("./app/broker/brokerAlerts/services/alertSnapshot.db");
const tradeAlert_db_1 = require("./app/trade/services/tradeAlert.db");
const cTrader_1 = require("./app/cTraderListener/services/cTrader");
const mt5Listener_services_1 = require("./app/mt5Listener/mt5Listener.services");
const mt5Listener_db_1 = require("./app/mt5Listener/mt5Listener.db");
const auth_1 = require("./middleware/auth");
const admin_service_1 = require("./app/admin/admin.service");
const copyExecution_service_1 = require("./app/copyExecution/copyExecution.service");
const brokerInstrument_service_1 = require("./app/india/options/brokerInstrument.service");
dotenv_1.default.config();
const DEFAULT_JSON_LIMIT = "100kb";
const CTRADER_SYMBOL_CACHE_JSON_LIMIT = "5mb";
function captureRawBody(req, _res, buf) {
    if (req.originalUrl?.startsWith("/billing/razorpay/webhook") ||
        req.originalUrl?.startsWith("/billing/razorpayx/webhook")) {
        req.rawBody = buf;
    }
}
function isPayloadTooLargeError(err) {
    const anyErr = err;
    return (anyErr?.type === "entity.too.large" ||
        Number(anyErr?.status) === 413 ||
        Number(anyErr?.statusCode) === 413);
}
function isCTraderSymbolReplaceRequest(req) {
    const path = String(req.originalUrl ?? req.path ?? "").split("?")[0];
    return (req.method.toUpperCase() === "PUT" &&
        /^\/ctrader\/symbols\/[^/]+\/(?:demo|live)\/[^/]+$/.test(path));
}
function isMt5StateSyncRequest(req) {
    const path = String(req.originalUrl ?? req.path ?? "").split("?")[0];
    return req.method.toUpperCase() === "POST" && path === "/signal/state";
}
class Server {
    constructor() {
        this.app = (0, express_1.default)();
        this.port = Number(process.env.PORT) || 3000;
        this.crmSyncService = new crmLifecycleSync_service_1.CrmLifecycleSyncService();
        this.supportTicketService = new supportTicket_service_1.SupportTicketService();
        this.strategyService = new strategy_1.StrategyService();
        this.subscriptionPlanService = new subscriptionPlan_1.SubscriptionPlanService();
        this.userSubscriptionService = new userSubscription_1.UserSubscriptionService();
        this.userService = new user_service_1.UserService();
        this.billingDb = new billing_db_1.BillingDBService();
        this.alertSnapshotDB = new alertSnapshot_db_1.AlertSnapshotDB();
        this.tradeAlertDB = new tradeAlert_db_1.TradeAlertDBService();
        this.cTraderService = new cTrader_1.CTraderService();
        this.mt5ListenerService = new mt5Listener_services_1.Mt5ListenerServices(new mt5Listener_db_1.Mt5ListenerDBServices(data_source_1.default));
        this.adminService = new admin_service_1.AdminService();
        this.copyExecutionService = new copyExecution_service_1.CopyExecutionService();
        this.brokerInstrumentService = new brokerInstrument_service_1.BrokerInstrumentService();
        this.config();
        this.routes();
    }
    async bootstrapBackgroundWorkers() {
        if (Server.backgroundWorkersStarted) {
            return;
        }
        await Promise.all([
            Promise.resolve().then(() => __importStar(require("./cron/ctrader-exec.worker"))),
            Promise.resolve().then(() => __importStar(require("./cron/dhan-exec.worker"))),
            Promise.resolve().then(() => __importStar(require("./cron/zebu-exec.worker"))),
            Promise.resolve().then(() => __importStar(require("./cron/coindcx-exec.worker"))),
            Promise.resolve().then(() => __importStar(require("./cron/crm-sync.cron"))),
            Promise.resolve().then(() => __importStar(require("./cron/stale-jobs.worker"))),
            Promise.resolve().then(() => __importStar(require("./cron/delta-exec.worker"))),
            Promise.resolve().then(() => __importStar(require("./cron/zebu-instrument-sync.cron"))),
        ]);
        Server.backgroundWorkersStarted = true;
    }
    config() {
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
        this.app.use((0, cors_1.default)({
            origin: (origin, cb) => {
                if (!origin)
                    return cb(null, true);
                if (allowedOrigins.includes(origin))
                    return cb(null, true);
                return cb(new Error("CORS blocked"), false);
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Poll-Key"],
        }));
        this.app.use((0, cookie_parser_1.default)());
        this.app.use("/uploads", express_1.default.static(path_1.default.resolve(process.cwd(), "uploads")));
    }
    routes() {
        this.app.put("/ctrader/symbols/:userId/:env/:accountId", express_1.default.json({
            limit: CTRADER_SYMBOL_CACHE_JSON_LIMIT,
            verify: captureRawBody,
        }), (_req, _res, next) => next());
        this.app.post("/signal/state", express_1.default.json({
            limit: CTRADER_SYMBOL_CACHE_JSON_LIMIT,
            verify: captureRawBody,
        }), (_req, _res, next) => next());
        this.app.use(express_1.default.json({
            limit: DEFAULT_JSON_LIMIT,
            verify: captureRawBody,
        }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: DEFAULT_JSON_LIMIT }));
        this.app.use("/", new routes_1.ApplicationRouter().getRouter());
        this.app.get("/health", (_, res) => res.send("OK"));
        this.app.get("/api/openapi.json", (_req, res) => {
            res.status(200).json((0, openapi_1.getTradingOpenApi)());
        });
        this.app.get("/api/docs", (_req, res) => {
            res
                .status(200)
                .send(`<!doctype html><html><head><title>Trading Service Docs</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:1000px;margin:0 auto}pre{white-space:pre-wrap;background:#111827;color:#f9fafb;padding:16px;border-radius:8px}</style></head><body><h1>Trading Service Docs</h1><p>OpenAPI JSON: <a href="/api/openapi.json">/api/openapi.json</a></p><pre>${JSON.stringify((0, openapi_1.getTradingOpenApi)(), null, 2)}</pre></body></html>`);
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
        this.app.use((err, req, res, next) => {
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
    async start() {
        try {
            (0, auth_1.getJwtSecret)();
            await (0, data_source_1.ensureAppDataSourceInitialized)();
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
            const enableSchemaValidation = String(process.env.ENABLE_SCHEMA_VALIDATION || "").toLowerCase() ===
                "true";
            if (enableSchemaValidation) {
                await (0, validateSchema_1.default)(data_source_1.default);
            }
            await this.bootstrapBackgroundWorkers();
            (0, kite_1.initKite)().catch(console.error);
            this.app.listen(this.port, () => {
                console.log(`🚀 Server running on ${this.port}`);
            });
        }
        catch (e) {
            console.error("Server start failed", e);
            setTimeout(() => this.start(), 5000);
        }
    }
}
Server.backgroundWorkersStarted = false;
exports.default = Server;
