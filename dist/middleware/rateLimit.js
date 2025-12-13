"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
class RateLimiter {
    constructor(options) {
        this.buckets = new Map();
        this.windowMs = options?.windowMs ?? 60000;
        this.max = options?.max ?? 5;
        this.keyExtractor =
            options?.keyExtractor ??
                ((req) => req.ip ?? (req.socket && req.socket.remoteAddress) ?? "");
    }
    middleware() {
        return (req, res, next) => {
            const key = this.keyExtractor(req);
            const now = Date.now();
            const entry = this.buckets.get(key);
            if (!entry || now - entry.ts > this.windowMs) {
                this.buckets.set(key, { count: 1, ts: now });
                return next();
            }
            entry.count += 1;
            if (entry.count > this.max) {
                res.status(429).json({ message: "Too many requests, try again later" });
                return;
            }
            return next();
        };
    }
}
function createRateLimiter(options) {
    const rl = new RateLimiter(options);
    return rl.middleware();
}
exports.default = { createRateLimiter };
