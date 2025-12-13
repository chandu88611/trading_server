"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const user_db_1 = require("./user.db");
const auth_1 = require("../../../middleware/auth");
const SALT_ROUNDS = 12;
class UserService {
    constructor() {
        this.db = new user_db_1.UserDBService();
    }
    async registerWithEmail(email, password, name) {
        const exists = await this.db.findByEmail(email);
        if (exists)
            throw new Error("Email already registered");
        const hash = await bcryptjs_1.default.hash(password, SALT_ROUNDS);
        const user = await this.db.createUser({
            email,
            name,
            password_hash: hash,
            is_email_verified: false,
        });
        // issue tokens
        const access = (0, auth_1.signAccessToken)({ userId: user.id, roles: [auth_1.Roles.USER] });
        const refreshPlain = crypto_1.default.randomBytes(48).toString("hex");
        const refreshHash = crypto_1.default
            .createHash("sha256")
            .update(refreshPlain)
            .digest("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); // 15 days
        await this.db.saveRefreshToken(user, refreshHash, expiresAt);
        const refreshJwt = (0, auth_1.signRefreshToken)({
            userId: user.id,
            tokenHash: refreshHash,
        });
        return { user, accessToken: access, refreshToken: refreshJwt };
    }
    async registerWithProvider(provider, providerUserId, email, name) {
        // find or create user
        let user = null;
        if (email)
            user = await this.db.findByEmail(email);
        if (!user) {
            user = await this.db.createUser({
                email: email ?? null,
                name: name ?? null,
                is_email_verified: !!email,
            });
        }
        await this.db.createAuthProvider(user, provider, providerUserId, {
            createdAt: new Date(),
        });
        const access = (0, auth_1.signAccessToken)({ userId: user.id, roles: [auth_1.Roles.USER] });
        const refreshPlain = crypto_1.default.randomBytes(48).toString("hex");
        const refreshHash = crypto_1.default
            .createHash("sha256")
            .update(refreshPlain)
            .digest("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); // 15 days
        await this.db.saveRefreshToken(user, refreshHash, expiresAt);
        const refreshJwt = (0, auth_1.signRefreshToken)({
            userId: user.id,
            tokenHash: refreshHash,
        });
        return { user, accessToken: access, refreshToken: refreshJwt };
    }
}
exports.UserService = UserService;
