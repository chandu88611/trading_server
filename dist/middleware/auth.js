"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Roles = void 0;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
var Roles;
(function (Roles) {
    Roles["USER"] = "USER";
    Roles["ADMIN"] = "ADMIN";
})(Roles || (exports.Roles = Roles = {}));
const ACCESS_TOKEN_EXPIRES = "30d";
const REFRESH_TOKEN_EXPIRES = "15d";
const JWT_SECRET = process.env.JWT_SECRET || "please-change-me";
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign({ ...payload, type: "access" }, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRES,
    });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign({ ...payload, type: "refresh" }, JWT_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES,
    });
}
function requireAuth(roles) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const token = authHeader.slice("Bearer ".length);
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            if (decoded.type !== "access")
                return res.status(401).json({ message: "Invalid token type" });
            req.auth = { userId: decoded.userId, roles: decoded.roles };
            if (roles && roles.length) {
                const has = decoded.roles && roles.some((r) => decoded.roles.includes(r));
                if (!has)
                    return res.status(403).json({ message: "Forbidden" });
            }
            return next();
        }
        catch (err) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }
    };
}
exports.default = { requireAuth, signAccessToken, signRefreshToken, Roles };
