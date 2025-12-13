"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const entity_1 = require("../entity");
dotenv_1.default.config();
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5449;
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port,
    username: process.env.DB_USER || "kite",
    password: process.env.DB_PASSWORD || "kitepass",
    database: process.env.DB_NAME || "kite",
    synchronize: false,
    logging: false,
    entities: [
        entity_1.User,
        entity_1.KiteSession,
        entity_1.KiteJob,
        entity_1.KiteEvent,
        entity_1.KiteCredential,
        entity_1.AuthProvider,
    ],
    migrations: [],
    subscribers: [],
});
exports.default = exports.AppDataSource;
