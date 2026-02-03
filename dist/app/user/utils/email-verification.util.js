"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmailVerificationToken = generateEmailVerificationToken;
const crypto_1 = __importDefault(require("crypto"));
const TOKEN_BYTES = 32;
function generateEmailVerificationToken() {
    const raw = crypto_1.default.randomBytes(TOKEN_BYTES).toString("hex");
    const hash = crypto_1.default.createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
}
