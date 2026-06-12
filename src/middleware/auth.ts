import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export enum Roles {
  USER = "USER",
  ADMIN = "ADMIN",
}

const ACCESS_TOKEN_EXPIRES = "30d"; // keep short for access
const REFRESH_TOKEN_EXPIRES = "15d";

const KNOWN_WEAK_SECRETS = new Set([
  "dev-only-secret-change-me",
  "change-me-before-production",
  "secret",
  "jwt_secret",
  "your-secret-here",
  "mysecret",
  "password",
  "test",
]);

// ✅ Always read secret from env at runtime (not once at import)
export function getJwtSecret() {
  const s = process.env.JWT_SECRET?.trim();

  if (!s || KNOWN_WEAK_SECRETS.has(s.toLowerCase())) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET is missing or set to a known-weak default value. " +
        "Generate a strong secret with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
      );
    }
    // Dev fallback — only acceptable on localhost
    if (!s) return "dev-only-secret-change-me";
  }

  if (s && s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be at least 32 characters in production.");
    }
  }

  return s || "dev-only-secret-change-me";
}

function mask(t?: string | null) {
  if (!t) return "null";
  return `${t.slice(0, 12)}...${t.slice(-8)}`;
}

export function signAccessToken(payload: Record<string, any>) {
  const secret = getJwtSecret();
  const token = jwt.sign({ ...payload, type: "access" }, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  console.log(
    "[JWT] signAccessToken secretLen:",
    secret.length,
    "token:",
    mask(token)
  );
  return token;
}

export function signWebhookToken(payload: Record<string, any>, expiresAt: Date) {
  const secret = getJwtSecret();
  const nowMs = Date.now();
  const expMs = expiresAt.getTime();

  const seconds = Math.max(1, Math.floor((expMs - nowMs) / 1000));
  const token = jwt.sign({ ...payload, type: "webhook" }, secret, {
    expiresIn: seconds,
  });

  console.log(
    "[JWT] signWebhookToken secretLen:",
    secret.length,
    "token:",
    mask(token)
  );

  return token;
}

export function signRefreshToken(payload: Record<string, any>) {
  const secret = getJwtSecret();
  const token = jwt.sign({ ...payload, type: "refresh" }, secret, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

  console.log(
    "[JWT] signRefreshToken secretLen:",
    secret.length,
    "token:",
    mask(token)
  );
  return token;
}

export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    roles?: Roles[];
    subscriptionId?: string;
    planId?: number;
    tokenType?: "access" | "webhook";
  };
}

/**
 * ✅ Bearer token guard (your old flow)
 */
export function requireAuth(_roles?: Roles[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log("[AUTH] requireAuth:", req.method, req.originalUrl);

    let token: string | undefined;

    // 1️⃣ Try Authorization header (Postman / API)
    const authHeader = req.headers.authorization;
    console.log("[AUTH] authHeader present?:", Boolean(authHeader));

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
      console.log("[AUTH] token source: Bearer");
    }

    // 2️⃣ Fallback to cookie (browser)
    if (!token) {
      // if cookie-parser is used
      token = (req as any).cookies?.access_token;

      // fallback without cookie-parser
      if (!token && req.headers.cookie) {
        const match = req.headers.cookie.match(
          /(?:^|;\s*)access_token=([^;]+)/
        );
        if (match) token = decodeURIComponent(match[1]);
      }

      if (token) console.log("[AUTH] token source: Cookie");
    }

    // ❌ No token anywhere
    if (!token) {
      console.log("[AUTH] ❌ no token found");
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const secret = getJwtSecret();
      console.log(
        "[AUTH] verify secretLen:",
        secret.length,
        "token:",
        mask(token)
      );

      const decoded = jwt.verify(token, secret) as any;

      if (!["access", "webhook"].includes(decoded.type)) {
        return res.status(401).json({ message: "Invalid token type" });
      }

      req.auth = {
        userId: String(decoded.userId),
        roles: decoded.roles || [],
        subscriptionId:
          decoded.subscriptionId !== undefined && decoded.subscriptionId !== null
            ? String(decoded.subscriptionId)
            : undefined,
        planId:
          decoded.planId !== undefined && decoded.planId !== null
            ? Number(decoded.planId)
            : undefined,
        tokenType: decoded.type,
      };
      if(req.auth.roles?.length === 0){
        req.auth.roles = [Roles.USER]
      }

      console.log(
        "[AUTH] verified token for userId:",
        req.auth.userId,
        "roles:",
        req.auth.roles
      );

      if (_roles && _roles.length) {
        const tokenRoles = req.auth.roles ?? [];
        const hasRole = _roles.some((role) => tokenRoles.includes(role));
        if (!hasRole) {
          console.log("[AUTH] ❌ role mismatch");
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      return next();
    } catch (err: any) {
      console.log("[AUTH] ❌ verify failed:", err?.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}

export interface WebhookAuthRequest extends Request {
  webhookAuth?: {
    userId: string;
    subscriptionId?: string;
    planId?: number;
  };
}

export function requireWebhookAuth() {
  return (req: WebhookAuthRequest, res: Response, next: NextFunction) => {
    console.log("[WEBHOOK_AUTH]", req.method, req.originalUrl);

    const token =
      (req.headers["x-webhook-token"] as string | undefined) ||
      (req.query.token as string | undefined) ||
      (req.body?.token as string | undefined) ||
      (req.body?.webhook_token as string | undefined);

    if (!token) {
      console.log("[WEBHOOK_AUTH] ❌ no token found");
      return res.status(401).json({ message: "Webhook token missing" });
    }

    try {
      const secret = getJwtSecret();
      console.log(
        "[WEBHOOK_AUTH] verify secretLen:",
        secret.length,
        "token:",
        mask(token)
      );

      const decoded = jwt.verify(token, secret) as any;

      if (decoded.type !== "webhook") {
        return res.status(401).json({ message: "Invalid webhook token type" });
      }

      req.webhookAuth = {
        userId: String(decoded.userId),
        subscriptionId: decoded.subscriptionId ? String(decoded.subscriptionId) : undefined,
        planId: decoded.planId ? decoded.planId : undefined,
      };

      console.log("[WEBHOOK_AUTH] ✅ userId:", req.webhookAuth.userId);
      return next();
    } catch (err: any) {
      console.log("[WEBHOOK_AUTH] ❌ verify failed:", err?.message);
      return res.status(401).json({ message: "Invalid or expired webhook token" });
    }
  };
}


export default {
  requireAuth,
  signAccessToken,
  signRefreshToken,
  getJwtSecret,
  Roles,
};
