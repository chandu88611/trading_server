"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const data_source_1 = __importDefault(require("./db/data-source"));
const kite_1 = require("./kite");
const validateSchema_1 = __importDefault(require("./db/validateSchema"));
dotenv_1.default.config();
class Server {
    constructor() {
        this.app = (0, express_1.default)();
        this.port = Number(process.env.PORT) || 3000;
        this.config();
        this.routes();
    }
    config() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
    }
    routes() {
        this.app.get("/", (_req, res) => {
            res.send("Server running successfully 🚀");
        });
    }
    async start() {
        try {
            console.log("⏳ Connecting to database...");
            if (!data_source_1.default.isInitialized) {
                await data_source_1.default.initialize();
                console.log("✅ Database connected");
            }
            else {
                console.log("✅ DataSource already initialized");
            }
            // Validate that required tables exist (we do not use synchronize in prod)
            await (0, validateSchema_1.default)(data_source_1.default).catch((err) => {
                console.error("Schema validation failed", err);
                throw err;
            });
            // Initialize KiteConnect integration (optional — requires env vars)
            (0, kite_1.initKite)().catch((err) => console.error("Kite init failed", err));
            this.app.listen(this.port, () => {
                console.log(`🚀 Server running at PORT ::: ${this.port}`);
            });
        }
        catch (error) {
            console.error("❌ Failed to start server:", error);
            setTimeout(() => {
                console.log("🔄 Retrying to start the server in 5 sec ...");
                this.start();
            }, 5000);
        }
    }
}
exports.default = Server;
