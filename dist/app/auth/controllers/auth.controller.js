"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const https_1 = __importDefault(require("https"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const user_service_1 = require("../../user/services/user.service");
const user_db_1 = require("../../user/services/user.db");
const auth_1 = require("../../../middleware/auth");
const token_1 = require("../../../types/token");
const email_service_1 = require("../../../types/email.service");
const auth_service_1 = require("../services/auth.service");
const userService = new user_service_1.UserService();
const userDb = new user_db_1.UserDBService();
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const ACCESS_TTL_MS = 1000 * 60 * 15; // 15 min
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 15; // 15 days
/**
 * IMPORTANT:
 * If frontend is on different origin (localhost or globalalgotrading.com),
 * you MUST use sameSite:none + secure:true for cookies to be sent in XHR.
 */
function getCookieOptions() {
    const sameSite = "none";
    const secure = true;
    // If you want to share across subdomains:
    // domain: ".globalalgotrading.com"
    const domain = process.env.COOKIE_DOMAIN?.trim() || undefined; // ".globalalgotrading.com"
    return {
        httpOnly: true,
        secure,
        sameSite,
        path: "/",
        ...(domain ? { domain } : {}),
    };
}
function mask(token) {
    if (!token)
        return "null";
    return `${token.slice(0, 12)}...${token.slice(-8)}`;
}
function setAuthCookies(res, accessJwt, refreshJwt) {
    const base = getCookieOptions();
    console.log("[AUTH] setAuthCookies base:", base);
    console.log("[AUTH] setAuthCookies access:", mask(accessJwt));
    console.log("[AUTH] setAuthCookies refresh:", mask(refreshJwt));
    res.cookie(ACCESS_COOKIE, accessJwt, { ...base, maxAge: ACCESS_TTL_MS });
    res.cookie(REFRESH_COOKIE, refreshJwt, { ...base, maxAge: REFRESH_TTL_MS });
    // confirm Set-Cookie header exists
    const sc = res.getHeader("Set-Cookie");
    console.log("[AUTH] response Set-Cookie header set?:", Boolean(sc));
}
function clearAuthCookies(res) {
    const base = getCookieOptions();
    console.log("[AUTH] clearAuthCookies base:", base);
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
    const sc = res.getHeader("Set-Cookie");
    console.log("[AUTH] clearAuthCookies Set-Cookie header set?:", Boolean(sc));
}
function logReq(req, label) {
    const rawCookie = req.headers.cookie || "";
    const parsedKeys = Object.keys(req.cookies || {});
    console.log(`[AUTH] ===== ${label} =====`);
    console.log("[AUTH] method:", req.method, "url:", req.originalUrl);
    console.log("[AUTH] origin:", req.headers.origin);
    console.log("[AUTH] host:", req.headers.host, "x-forwarded-proto:", req.headers["x-forwarded-proto"]);
    console.log("[AUTH] cookie header length:", rawCookie.length);
    console.log("[AUTH] cookie header has access?:", rawCookie.includes("access_token="), "has refresh?:", rawCookie.includes("refresh_token="));
    console.log("[AUTH] req.cookies parsed?:", Boolean(req.cookies), "keys:", parsedKeys);
}
class AuthController {
    constructor() {
        this.authService = new auth_service_1.AuthService();
    }
    async login(req, res) {
        logReq(req, "LOGIN");
        try {
            const { email, password } = req.body ?? {};
            if (!email || !password)
                return res.status(400).json({ message: "email and password required" });
            const result = await userService.loginWithEmail(email, password);
            setAuthCookies(res, result.accessToken, result.refreshToken);
            return res.status(200).json({
                message: "Logged in",
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    name: result.user.name,
                    access: result.accessToken,
                    refresh: result.refreshToken,
                },
            });
        }
        catch (err) {
            console.log("[AUTH] login error:", err?.message);
            return res.status(400).json({ message: err.message || "Login failed" });
        }
    }
    async google(req, res) {
        logReq(req, "GOOGLE");
        try {
            const { id_token } = req.body ?? {};
            if (!id_token)
                return res.status(400).json({ message: "id_token required" });
            const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`;
            console.log("[AUTH] google verifyUrl:", verifyUrl.slice(0, 80) + "...");
            const info = await new Promise((resolve, reject) => {
                https_1.default
                    .get(verifyUrl, (resp) => {
                    let data = "";
                    resp.on("data", (chunk) => (data += chunk));
                    resp.on("end", () => {
                        try {
                            if (resp.statusCode && resp.statusCode >= 400)
                                return reject(new Error("Invalid Google token"));
                            resolve(JSON.parse(data));
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                })
                    .on("error", reject);
            });
            console.log("[AUTH] google token payload:", {
                sub: info.sub,
                email: info.email,
                name: info.name,
                email_verified: String(info.email_verified),
            });
            if (!info.sub || !info.email)
                return res
                    .status(400)
                    .json({ message: "Invalid Google token payload" });
            const result = await userService.registerWithProvider("google", info.sub, info.email, info.name);
            setAuthCookies(res, result.accessToken, result.refreshToken);
            console.log("[AUTH] google login success userId:", result.user.id, "email:", result.user.email);
            return res.status(200).json({
                message: "Logged in via Google",
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    name: result.user.name,
                },
            });
        }
        catch (err) {
            console.log("[AUTH] google error:", err?.message);
            return res
                .status(500)
                .json({ message: err.message || "Google auth failed" });
        }
    }
    async me(req, res) {
        try {
            console.log("[AUTH] ===== ME =====");
            console.log("[AUTH] method:", req.method, "url:", req.originalUrl);
            console.log("[AUTH] origin:", req.headers.origin);
            console.log("[AUTH] cookies keys:", Object.keys(req.cookies || {}));
            const accessToken = req.cookies?.[ACCESS_COOKIE];
            console.log("[AUTH] ME access cookie:", accessToken
                ? `${accessToken.slice(0, 12)}...${accessToken.slice(-8)}`
                : "null");
            if (!accessToken) {
                console.log("[AUTH] ME no access cookie -> 401");
                return res.status(401).json({ message: "Unauthorized" });
            }
            const secret = (0, auth_1.getJwtSecret)();
            console.log("[AUTH] ME verify secretLen:", secret.length);
            const payload = jsonwebtoken_1.default.verify(accessToken, secret);
            console.log("[AUTH] ME payload:", {
                userId: payload.userId,
                type: payload.type,
                roles: payload.roles,
                iat: payload.iat,
                exp: payload.exp,
            });
            if (payload.type !== "access") {
                console.log("[AUTH] ME invalid token type:", payload.type);
                return res.status(401).json({ message: "Unauthorized" });
            }
            const user = await userDb.findById(Number(payload.userId));
            if (!user) {
                console.log("[AUTH] ME user not found:", payload.userId);
                return res.status(401).json({ message: "Unauthorized" });
            }
            return res.json({
                user: { id: user.id, email: user.email, name: user.name },
            });
        }
        catch (e) {
            console.log("[AUTH] ME error:", e?.message);
            return res.status(401).json({ message: "Unauthorized" });
        }
    }
    async refresh(req, res) {
        logReq(req, "REFRESH");
        try {
            const refreshToken = req.cookies?.[REFRESH_COOKIE];
            console.log("[AUTH] REFRESH refresh cookie:", mask(refreshToken));
            if (!refreshToken)
                return res.status(401).json({ message: "Unauthorized" });
            const payload = jsonwebtoken_1.default.verify(refreshToken, (0, auth_1.getJwtSecret)());
            if (payload.type !== "refresh")
                return res.status(401).json({ message: "Unauthorized" });
            const userId = Number(payload.userId);
            const tokenHash = payload.tokenHash;
            const tokenRow = await userDb.findRefreshTokenForUser(userId, tokenHash);
            if (!tokenRow || tokenRow.revoked)
                return res.status(401).json({ message: "Unauthorized" });
            const newAccess = (0, auth_1.signAccessToken)({ userId, roles: ["USER"] });
            const refreshPlain = crypto_1.default.randomBytes(48).toString("hex");
            const newHash = crypto_1.default
                .createHash("sha256")
                .update(refreshPlain)
                .digest("hex");
            await userDb.revokeRefreshTokenByHash(tokenHash);
            const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
            await userDb.saveRefreshToken(tokenRow.user, newHash, expiresAt);
            const newRefresh = (0, auth_1.signRefreshToken)({ userId, tokenHash: newHash });
            setAuthCookies(res, newAccess, newRefresh);
            return res.json({ message: "refreshed" });
        }
        catch (e) {
            console.log("[AUTH] REFRESH error:", e?.message);
            return res.status(401).json({ message: "Unauthorized" });
        }
    }
    async logout(req, res) {
        logReq(req, "LOGOUT");
        try {
            const refreshToken = req.cookies?.[REFRESH_COOKIE];
            if (refreshToken) {
                try {
                    const payload = jsonwebtoken_1.default.verify(refreshToken, (0, auth_1.getJwtSecret)());
                    if (payload?.tokenHash)
                        await userDb.revokeRefreshTokenByHash(payload.tokenHash);
                }
                catch { }
            }
            clearAuthCookies(res);
            return res.json({ message: "Logged out" });
        }
        catch {
            clearAuthCookies(res);
            return res.json({ message: "Logged out" });
        }
    }
    async revoke(req, res) {
        return this.logout(req, res);
    }
    async registerUser(req, res) {
        const { email } = req.body;
        const token = (0, token_1.generateVerificationToken)();
        // ✅ Save token in DB with expiry (recommended)
        // await userRepo.save({ email, token, expiresAt })
        await (0, email_service_1.sendVerificationEmail)({ email, token });
        return res.status(200).json({
            message: "Verification email sent",
        });
    }
    async verifyEmail(req, res) {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ message: "Invalid token" });
        }
        // 1. Find user by token
        // 2. Check expiry
        // 3. Mark email as verified
        // 4. Remove token
        return res.status(200).json({
            message: "Email verified successfully",
        });
    }
}
exports.AuthController = AuthController;
exports.default = new AuthController();
