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

dotenv.config();

export default class Server {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = Number(process.env.PORT) || 3000;

    this.config();
    this.routes();
  }

  
private config() {
  const allowedOrigins = [
    process.env.FRONTEND_ORIGIN || "",
    "http://localhost:5173",
    "http://localhost:5175",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://globalalgotrading.com",
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
