import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export enum Roles {
  USER = "USER",
  ADMIN = "ADMIN",
}

const ACCESS_TOKEN_EXPIRES = "30d"; // keep short for access
const REFRESH_TOKEN_EXPIRES = "15d";

// ✅ Always read secret from env at runtime (not once at import)
export function getJwtSecret() {
  const s = process.env.JWT_SECRET?.trim();

  // In production: MUST be set (avoid random invalid signature issues)
  if (process.env.NODE_ENV === "production" && !s) {
    throw new Error("JWT_SECRET is missing in production");
  }

  // Dev fallback (ok for localhost only)
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
  auth?: { userId: string; roles?: Roles[] };
}

/**
 * ✅ Bearer token guard (your old flow)
 */
export function requireAuth(roles?: Roles[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    console.log("[AUTH] requireAuth:", req.method, req.originalUrl);
    console.log("[AUTH] authHeader present?:", Boolean(authHeader));

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const secret = getJwtSecret();
      console.log(
        "[AUTH] verify Bearer secretLen:",
        secret.length,
        "token:",
        mask(token)
      );

      const decoded = jwt.verify(token, secret) as any;

      if (decoded.type !== "access") {
        return res.status(401).json({ message: "Invalid token type" });
      }

      req.auth = { userId: String(decoded.userId), roles: decoded.roles };
      console.log(
        "[AUTH] verified token for userId:",
        req.auth.userId,
        "roles:",
        req.auth.roles
      );

      if (roles && roles.length) {
        const has =
          decoded.roles && roles.some((r) => decoded.roles.includes(r));
        if (!has) return res.status(403).json({ message: "Forbidden" });
      }

      return next();
    } catch (err: any) {
      console.log("[AUTH] ❌ Bearer verify failed:", err?.message);
      return res.status(401).json({ message: "Invalid or expired token" });
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
