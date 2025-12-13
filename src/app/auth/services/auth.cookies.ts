// src/app/auth/utils/auth.cookies.ts
import { Response } from "express";

const isProd = process.env.NODE_ENV === "production";

export const COOKIE_NAMES = {
  access: "access_token",
  refresh: "refresh_token",
};

export function setAuthCookies(res: Response, accessJwt: string, refreshJwt: string) {
  const common = {
    httpOnly: true,
    secure: true,           // ✅ must be true for SameSite=None
    sameSite: "none" as const,
    path: "/",
  };

  // access token short ttl (example 15m)
  res.cookie(COOKIE_NAMES.access, accessJwt, {
    ...common,
    maxAge: 1000 * 60 * 15,
  });

  // refresh token longer ttl (example 15 days)
  res.cookie(COOKIE_NAMES.refresh, refreshJwt, {
    ...common,
    maxAge: 1000 * 60 * 60 * 24 * 15,
  });
}

export function clearAuthCookies(res: Response) {
  const common = {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
  };

  res.clearCookie(COOKIE_NAMES.access, common);
  res.clearCookie(COOKIE_NAMES.refresh, common);
}
