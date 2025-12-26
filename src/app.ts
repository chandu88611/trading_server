import "reflect-metadata";
import express, { Application } from "express";
import dotenv from "dotenv";
import AppDataSource from "./db/data-source";
import { initKite } from "./kite";
import validateSchema from "./db/validateSchema";
import { ApplicationRouter } from "./app/routes";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import axios from "axios";
import WebSocket, { RawData } from "ws";
import crypto from "crypto";

dotenv.config();

const CTRADER_CLIENT_ID = (process.env.CTRADER_CLIENT_ID || "").trim();
const CTRADER_CLIENT_SECRET = (process.env.CTRADER_CLIENT_SECRET || "").trim();
const CTRADER_REDIRECT_URI = (process.env.CTRADER_REDIRECT_URI || "").trim();
const CTRADER_ENV = (process.env.CTRADER_ENV || "live").trim();

const GRANT_URL = "https://id.ctrader.com/my/settings/openapi/grantingaccess/";
const TOKEN_URL = "https://openapi.ctrader.com/apps/token";

const PT = {
  ERROR_RES: 50,
  HEARTBEAT_EVENT: 51,

  OA_APPLICATION_AUTH_REQ: 2100,
  OA_APPLICATION_AUTH_RES: 2101,

  OA_ACCOUNT_AUTH_REQ: 2102,
  OA_ACCOUNT_AUTH_RES: 2103,

  OA_TRADER_REQ: 2121,
  OA_TRADER_RES: 2122,

  OA_GET_ACCOUNT_LIST_BY_ACCESS_TOKEN_REQ: 2149,
  OA_GET_ACCOUNT_LIST_BY_ACCESS_TOKEN_RES: 2150,

  OA_ERROR_RES: 2142,
} as const;

type StartOpenApiArgs = {
  accessToken: string;
  preferredEnv?: string;
};

export default class Server {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = Number(process.env.PORT) || 3000;

    this.config();
    this.routes();
  }

  private wsEndpoint(env?: string) {
    const e = (env || "demo").toLowerCase() === "live" ? "live" : "demo";
    // JSON endpoint uses 5036
    return `wss://${e}.ctraderapi.com:5036`;
  }

  private uid() {
    return crypto.randomUUID();
  }

  private startOpenApiSession({ accessToken, preferredEnv }: StartOpenApiArgs) {
    return new Promise((resolve, reject) => {
      const endpoint = this.wsEndpoint(preferredEnv || CTRADER_ENV);
      console.log("[cTrader][WS] connecting:", endpoint);

      const ws = new WebSocket(endpoint, { rejectUnauthorized: true });

      let heartbeatTimer: NodeJS.Timeout | null = null;
      let pickedAccount: any = null;

      const send = (
        payloadType: number,
        payload: any,
        clientMsgId: string = this.uid()
      ) => {
        const msg = { clientMsgId, payloadType, payload };
        ws.send(JSON.stringify(msg));
      };

      ws.on("open", () => {
        console.log("[cTrader][WS] connected");

        heartbeatTimer = setInterval(() => {
          try {
            send(PT.HEARTBEAT_EVENT, {});
          } catch {}
        }, 25000);

        send(PT.OA_APPLICATION_AUTH_REQ, {
          clientId: CTRADER_CLIENT_ID,
          clientSecret: CTRADER_CLIENT_SECRET,
        });
      });

      ws.on("message", (data: RawData) => {
        const text = data.toString("utf8");
        let msg: any;

        try {
          msg = JSON.parse(text);
        } catch {
          console.log("[cTrader][WS] non-json message:", text);
          return;
        }

        const { payloadType, payload } = msg;

        if (payloadType === PT.ERROR_RES) {
          console.error("[cTrader][ProtoErrorRes]", payload);
          return;
        }

        if (payloadType === PT.OA_ERROR_RES) {
          console.error("[cTrader][ProtoOAErrorRes]", payload);
          return;
        }

        if (payloadType === PT.OA_APPLICATION_AUTH_RES) {
          console.log("[cTrader][OK] Application authorized");

          send(PT.OA_GET_ACCOUNT_LIST_BY_ACCESS_TOKEN_REQ, { accessToken });
          return;
        }

        if (payloadType === PT.OA_GET_ACCOUNT_LIST_BY_ACCESS_TOKEN_RES) {
          const accounts = payload?.ctidTraderAccount || [];
          console.log(`[cTrader][OK] Accounts returned: ${accounts.length}`);

          if (!accounts.length) {
            console.error(
              "[cTrader] No accounts returned. Check token/scope/grant."
            );
            return;
          }

          pickedAccount = accounts[0];

          send(PT.OA_ACCOUNT_AUTH_REQ, {
            ctidTraderAccountId: pickedAccount.ctidTraderAccountId,
            accessToken,
          });
          return;
        }

        if (payloadType === PT.OA_ACCOUNT_AUTH_RES) {
          console.log(
            "[cTrader][OK] Account authorized:",
            payload?.ctidTraderAccountId
          );

          send(PT.OA_TRADER_REQ, {
            ctidTraderAccountId: payload.ctidTraderAccountId,
          });
          return;
        }

        if (payloadType === PT.OA_TRADER_RES) {
          console.log("[cTrader][OK] Trader info received");
          resolve({ ws, trader: payload, account: pickedAccount });
          return;
        }
      });

      ws.on("close", () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        console.log("[cTrader][WS] closed");
      });

      ws.on("error", (err) => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        reject(err);
      });
    });
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
    ].filter(Boolean);

    this.app.use(
      cors({
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.includes(origin)) return cb(null, true);
          return cb(new Error("CORS blocked"), false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    this.app.use(cookieParser());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private routes() {
    this.app.use(
      bodyParser.json({
        verify: (req: any, res, buf: Buffer) => {
          if (req.originalUrl?.startsWith("/stripe/webhook")) {
            req.rawBody = buf;
          }
        },
      })
    );

    this.app.use("/", new ApplicationRouter().getRouter());

    this.app.get("/health", (_, res) => res.send("OK"));

    this.app.get("/ctrader/auth", (_req, res) => {
      if (
        !CTRADER_CLIENT_ID ||
        !CTRADER_CLIENT_SECRET ||
        !CTRADER_REDIRECT_URI
      ) {
        return res.status(500).json({
          ok: false,
          message:
            "Missing CTRADER_CLIENT_ID / CTRADER_CLIENT_SECRET / CTRADER_REDIRECT_URI in env",
        });
      }

      const url = new URL(GRANT_URL);
      url.searchParams.set("client_id", CTRADER_CLIENT_ID);
      url.searchParams.set("redirect_uri", CTRADER_REDIRECT_URI);
      url.searchParams.set("scope", "trading");
      url.searchParams.set("product", "web");

      return res.redirect(url.toString());
    });

    this.app.get("/ctrader/callback", async (req, res) => {
      try {
        const code = String(req.query.code || "");
        if (!code) return res.status(400).send("Missing ?code");

        const tokenResp = await axios.get(TOKEN_URL, {
          params: {
            grant_type: "authorization_code",
            code,
            redirect_uri: CTRADER_REDIRECT_URI,
            client_id: CTRADER_CLIENT_ID,
            client_secret: CTRADER_CLIENT_SECRET,
          },
          timeout: 20000,
        });

        const token: any = tokenResp.data;
        console.log("[cTrader][TOKEN]", token);

        this.startOpenApiSession({
          accessToken: token.accessToken,
          preferredEnv: CTRADER_ENV,
        })
          .then(() => console.log("[cTrader][DONE] WS flow finished"))
          .catch((e) =>
            console.error("[cTrader][WS FLOW ERROR]", e?.message || e)
          );

        return res.json({
          ok: true,
          tokenType: token.tokenType,
          expiresIn: token.expiresIn,
          accessTokenPreview:
            String(token.accessToken || "").slice(0, 10) + "...",
          note: "Check server logs for WS auth + account list + trader info.",
        });
      } catch (e: any) {
        console.error("[cTrader][TOKEN ERROR]", e?.response?.data || e);
        return res.status(500).send("Token exchange failed. Check logs.");
      }
    });
  }

  public async start() {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      await validateSchema(AppDataSource);
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
