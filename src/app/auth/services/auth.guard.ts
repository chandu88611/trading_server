import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthCookieManager } from "./auth.cookie.manager";
import { getJwtSecret } from "../../../middleware/auth"; // adjust path if needed

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    roles: string[];
  };
}

function mask(t?: string | null) {
  if (!t) return "null";
  return `${t.slice(0, 12)}...${t.slice(-8)}`;
}

export class AuthGuard {
  static requireUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = AuthCookieManager.getAccessToken(req);

      console.log("[AUTH-GUARD] requireUser:", req.method, req.originalUrl);
      console.log("[AUTH-GUARD] origin:", req.headers.origin);
      console.log("[AUTH-GUARD] cookie keys:", Object.keys((req as any).cookies || {}));
      console.log("[AUTH-GUARD] access token:", mask(token));

      if (!token) return res.status(401).json({ message: "Unauthorized" });

      const secret = getJwtSecret();
      console.log("[AUTH-GUARD] verify secretLen:", secret.length);

      const payload = jwt.verify(token, secret) as any;

      console.log("[AUTH-GUARD] payload:", {
        userId: payload.userId,
        type: payload.type,
        roles: payload.roles,
        iat: payload.iat,
        exp: payload.exp,
      });

      if (payload.type !== "access") return res.status(401).json({ message: "Unauthorized" });

      req.user = {
        userId: Number(payload.userId),
        roles: payload.roles || ["USER"],
      };

      return next();
    } catch (e: any) {
      console.log("[AUTH-GUARD] ❌ verify failed:", e?.message);
      return res.status(401).json({ message: "Unauthorized" });
    }
  }
}
