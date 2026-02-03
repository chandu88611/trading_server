"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRawToken = generateRawToken;
exports.hashToken = hashToken;
exports.getVerificationExpiry = getVerificationExpiry;
exports.generateVerificationToken = generateVerificationToken;
const crypto_1 = __importDefault(require("crypto"));
const VERIFICATION_TOKEN_BYTES = 32;
function generateRawToken() {
    return crypto_1.default.randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");
}
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function getVerificationExpiry() {
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // 24h expiry
    return expires;
}
function generateVerificationToken() {
    const rawToken = generateRawToken();
    const hashedToken = hashToken(rawToken);
    const expiresAt = getVerificationExpiry();
    return { rawToken, hashedToken, expiresAt };
}
