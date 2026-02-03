"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_cookie_manager_1 = require("./auth.cookie.manager");
const auth_1 = require("../../../middleware/auth"); // adjust path if needed
function mask(t) {
    if (!t)
        return "null";
    return `${t.slice(0, 12)}...${t.slice(-8)}`;
}
class AuthGuard {
    static requireUser(req, res, next) {
        try {
            const token = auth_cookie_manager_1.AuthCookieManager.getAccessToken(req);
            console.log("[AUTH-GUARD] requireUser:", req.method, req.originalUrl);
            console.log("[AUTH-GUARD] origin:", req.headers.origin);
            console.log("[AUTH-GUARD] cookie keys:", Object.keys(req.cookies || {}));
            console.log("[AUTH-GUARD] access token:", mask(token));
            if (!token)
                return res.status(401).json({ message: "Unauthorized" });
            const secret = (0, auth_1.getJwtSecret)();
            console.log("[AUTH-GUARD] verify secretLen:", secret.length);
            const payload = jsonwebtoken_1.default.verify(token, secret);
            console.log("[AUTH-GUARD] payload:", {
                userId: payload.userId,
                type: payload.type,
                roles: payload.roles,
                iat: payload.iat,
                exp: payload.exp,
            });
            if (payload.type !== "access")
                return res.status(401).json({ message: "Unauthorized" });
            req.user = {
                userId: Number(payload.userId),
                roles: payload.roles || ["USER"],
            };
            return next();
        }
        catch (e) {
            console.log("[AUTH-GUARD] ❌ verify failed:", e?.message);
            return res.status(401).json({ message: "Unauthorized" });
        }
    }
}
exports.AuthGuard = AuthGuard;
