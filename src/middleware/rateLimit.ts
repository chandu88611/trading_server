// src/middleware/rateLimit.ts
import { Request, Response, NextFunction, RequestHandler } from "express";

type KeyExtractor = (req: Request) => string;

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  keyExtractor?: KeyExtractor;
}

class RateLimiter {
  private windowMs: number;
  private max: number;
  private keyExtractor: KeyExtractor;
  private buckets: Map<string, { count: number; ts: number }> = new Map();

  constructor(options?: RateLimiterOptions) {
    this.windowMs = options?.windowMs ?? 60_000;
    this.max = options?.max ?? 5;
    this.keyExtractor =
      options?.keyExtractor ??
      ((req) => req.ip ?? (req.socket && req.socket.remoteAddress) ?? "");
  }

  public middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
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

export function createRateLimiter(options?: RateLimiterOptions) {
  const rl = new RateLimiter(options);
  return rl.middleware();
}

export default { createRateLimiter };
