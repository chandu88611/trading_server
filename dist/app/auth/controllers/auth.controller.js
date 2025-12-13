"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const https_1 = __importDefault(require("https"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_service_1 = require("../../user/services/user.service");
const user_db_1 = require("../../user/services/user.db");
const auth_1 = require("../../../middleware/auth");
const userService = new user_service_1.UserService();
const userDb = new user_db_1.UserDBService();
class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await userService.loginWithEmail(email, password);
            return res
                .status(200)
                .json({
                message: "Logged in",
                tokens: { access: result.accessToken, refresh: result.refreshToken },
            });
        }
        catch (err) {
            return res.status(400).json({ message: err.message || "Login failed" });
        }
    }
    async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken)
                return res.status(400).json({ message: "refreshToken required" });
            const JWT_SECRET = process.env.JWT_SECRET || "please-change-me";
            const payload = jsonwebtoken_1.default.verify(refreshToken, JWT_SECRET);
            if (payload.type !== "refresh")
                return res.status(400).json({ message: "Invalid token type" });
            const { userId, tokenHash } = payload;
            const tokenRow = await userDb.findRefreshTokenForUser(userId, tokenHash);
            if (!tokenRow || tokenRow.revoked)
                return res
                    .status(401)
                    .json({ message: "Invalid or revoked refresh token" });
            // issue new access token and a fresh refresh token (rotation)
            const access = (0, auth_1.signAccessToken)({ userId, roles: ["USER"] });
            const refreshPlain = require("crypto").randomBytes(48).toString("hex");
            const refreshHash = require("crypto")
                .createHash("sha256")
                .update(refreshPlain)
                .digest("hex");
            // revoke old token and save new one
            await userDb.revokeRefreshTokenByHash(tokenHash);
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15);
            await userDb.saveRefreshToken(tokenRow.user, refreshHash, expiresAt);
            const refreshJwt = (0, auth_1.signRefreshToken)({ userId, tokenHash: refreshHash });
            return res.json({ access, refresh: refreshJwt });
        }
        catch (err) {
            return res
                .status(401)
                .json({ message: "Invalid or expired refresh token" });
        }
    }
    // simple Google provider flow: accept id_token from client, verify with Google, then register/login
    async google(req, res) {
        try {
            const { id_token } = req.body;
            if (!id_token)
                return res.status(400).json({ message: "id_token required" });
            // verify with Google tokeninfo endpoint using https
            const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`;
            const info = await new Promise((resolve, reject) => {
                https_1.default
                    .get(verifyUrl, (resp) => {
                    let data = "";
                    resp.on("data", (chunk) => (data += chunk));
                    resp.on("end", () => {
                        try {
                            const parsed = JSON.parse(data);
                            if (resp.statusCode && resp.statusCode >= 400)
                                return reject(new Error("Invalid Google token"));
                            resolve(parsed);
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                })
                    .on("error", (err) => reject(err));
            });
            const providerUserId = info.sub;
            const email = info.email;
            const name = info.name;
            const result = await userService.registerWithProvider("google", providerUserId, email, name);
            return res
                .status(200)
                .json({
                message: "Logged in via Google",
                user: { id: result.user.id, email: result.user.email },
                tokens: { access: result.accessToken, refresh: result.refreshToken },
            });
        }
        catch (err) {
            return res
                .status(500)
                .json({ message: err.message || "Google auth failed" });
        }
    }
    // revoke provided refresh token (logout)
    async revoke(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken)
                return res.status(400).json({ message: "refreshToken required" });
            const JWT_SECRET = process.env.JWT_SECRET || "please-change-me";
            const payload = jsonwebtoken_1.default.verify(refreshToken, JWT_SECRET);
            const { tokenHash } = payload;
            await userDb.revokeRefreshTokenByHash(tokenHash);
            return res.json({ message: "Revoked" });
        }
        catch (err) {
            return res.status(400).json({ message: "Invalid token" });
        }
    }
}
exports.AuthController = AuthController;
exports.default = new AuthController();
