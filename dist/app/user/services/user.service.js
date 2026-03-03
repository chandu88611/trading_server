"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
// src/app/user/services/user.service.ts
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const user_db_1 = require("./user.db");
const auth_1 = require("../../../middleware/auth");
const email_verification_util_1 = require("../utils/email-verification.util");
const email_verification_service_1 = require("./email-verification.service");
const SALT_ROUNDS = 12;
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 15; // 15 days
class UserService {
    constructor() {
        this.db = new user_db_1.UserDBService();
    }
    // ========== LOGIN WITH EMAIL/PASSWORD ==========
    async loginWithEmail(email, password) {
        if (!email || !password) {
            throw new Error("Email and password are required");
        }
        const user = await this.db.findByEmail(email);
        if (!user)
            throw new Error("Invalid credentials");
        const ok = await bcryptjs_1.default.compare(password, user.passwordHash || "");
        if (!ok)
            throw new Error("Invalid credentials");
        const access = (0, auth_1.signAccessToken)({ userId: user.id, roles: [auth_1.Roles.USER] });
        const { refreshJwt } = await this.issueRefreshToken(user);
        return { user, accessToken: access, refreshToken: refreshJwt };
    }
    // ========== REGISTER WITH EMAIL/PASSWORD ==========
    async registerWithEmail(email, password, name) {
        if (!email || !password) {
            throw new Error("Email and password are required");
        }
        const exists = await this.db.findByEmail(email);
        if (exists)
            throw new Error("Email already registered");
        const hash = await bcryptjs_1.default.hash(password, SALT_ROUNDS);
        const user = await this.db.createUser({
            email,
            name: name ?? null,
            passwordHash: hash,
            isEmailVerified: false,
        });
        const { raw, hash: tokenHash } = (0, email_verification_util_1.generateEmailVerificationToken)();
        await this.db.setEmailVerificationToken(user.id, tokenHash);
        await (0, email_verification_service_1.sendUserVerificationEmail)(user.email, raw);
        const access = (0, auth_1.signAccessToken)({ userId: user.id, roles: [auth_1.Roles.USER] });
        const { refreshJwt } = await this.issueRefreshToken(user);
        return {
            user,
            accessToken: access,
            refreshToken: refreshJwt,
            emailVerificationRequired: true,
        };
    }
    // ========== REGISTER/LOGIN WITH PROVIDER (GOOGLE, ETC) ==========
    async registerWithProvider(provider, providerUserId, email, name) {
        if (!provider || !providerUserId) {
            throw new Error("provider and providerUserId are required");
        }
        if (!email) {
            throw new Error("Email is required for provider signup");
        }
        let user = await this.db.findByEmail(email);
        // 1. If no user, create one with dummy password so DB NOT NULL is respected
        if (!user) {
            const dummyPassword = crypto_1.default.randomBytes(32).toString("hex");
            const dummyHash = await bcryptjs_1.default.hash(dummyPassword, SALT_ROUNDS);
            user = await this.db.createUser({
                email,
                name: name ?? null,
                passwordHash: dummyHash,
                isEmailVerified: true,
            });
        }
        // 2. Ensure provider record exists for this user
        let providerDetails = await this.db.getProvider(user.id);
        if (!providerDetails) {
            await this.db.createAuthProvider(user, provider, providerUserId, {
                createdAt: new Date(),
            });
        }
        // 3. Issue tokens
        const access = (0, auth_1.signAccessToken)({ userId: user.id, roles: [auth_1.Roles.USER] });
        const { refreshJwt } = await this.issueRefreshToken(user);
        return { user, accessToken: access, refreshToken: refreshJwt };
    }
    // ========== INTERNAL: ISSUE REFRESH TOKEN ==========
    async issueRefreshToken(user) {
        const refreshPlain = crypto_1.default.randomBytes(48).toString("hex");
        const refreshHash = crypto_1.default
            .createHash("sha256")
            .update(refreshPlain)
            .digest("hex");
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        await this.db.saveRefreshToken(user, refreshHash, expiresAt);
        const refreshJwt = (0, auth_1.signRefreshToken)({
            userId: user.id,
            tokenHash: refreshHash,
        });
        return { refreshJwt };
    }
    async verifyEmail(token) {
        if (!token) {
            throw new Error("Invalid token");
        }
        const tokenHash = crypto_1.default.createHash("sha256").update(token).digest("hex");
        const user = await this.db.findByVerificationToken(tokenHash);
        if (!user) {
            throw new Error("Invalid or expired verification token");
        }
        await this.db.markEmailVerified(user.id);
    }
    async getUserDetails(userId) {
        try {
            return this.db.getUserDetails(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async getBillingDetails(userId) {
        try {
            return this.db.getBillingDetails(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertBillingDetails(userId, payload) {
        try {
            return this.db.upsertBillingDetails(userId, payload);
        }
        catch (error) {
            throw error;
        }
    }
    async updateTradeStatus(userId, allowTrade) {
        try {
            return this.db.updateTradeStatus(userId, allowTrade);
        }
        catch (error) {
            throw error;
        }
    }
    async updateCopyTradeStatus(userId, allowCopyTrade) {
        try {
            return this.db.updateCopyTradeStatus(userId, allowCopyTrade);
        }
        catch (error) {
            throw error;
        }
    }
    async getEdgingStatus(userId) {
        try {
            return this.db.getEdgingStatus(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertEdgingStatus(userId, isEnabled, notes) {
        try {
            return this.db.upsertEdgingStatus(userId, isEnabled, notes);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.UserService = UserService;
