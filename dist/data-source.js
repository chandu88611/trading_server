"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = require("./entity/User");
dotenv_1.default.config();
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5449;
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port,
    username: process.env.DB_USER || "kite",
    password: process.env.DB_PASSWORD || "kitepass",
    database: process.env.DB_NAME || "kite",
    synchronize: true,
    logging: false,
    entities: [User_1.User],
    migrations: [],
    subscribers: [],
});
exports.default = exports.AppDataSource;
