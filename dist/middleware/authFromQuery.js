"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authFromQueryToken = authFromQueryToken;
function authFromQueryToken(req, _res, next) {
    const token = String(req.query.token ?? "").trim();
    if (!req.headers.authorization && token) {
        req.headers.authorization = `Bearer ${token}`;
    }
    console.log("Auth from query token middleware called", token);
    next();
}
