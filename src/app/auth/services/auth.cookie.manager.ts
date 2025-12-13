import { Response } from "express";

export class AuthCookieManager {
  private static readonly ACCESS_COOKIE = "access_token";
  private static readonly REFRESH_COOKIE = "refresh_token";

  private static baseOptions() {
    return {
      httpOnly: true,
      secure: true,        // REQUIRED for SameSite=None
      sameSite: "none" as const,
      path: "/",
    };
  }

  static setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string
  ) {
    res.cookie(this.ACCESS_COOKIE, accessToken, {
      ...this.baseOptions(),
      maxAge: 1000 * 60 * 15, // 15 mins
    });

    res.cookie(this.REFRESH_COOKIE, refreshToken, {
      ...this.baseOptions(),
      maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
    });
  }

  static clearAuthCookies(res: Response) {
    res.clearCookie(this.ACCESS_COOKIE, this.baseOptions());
    res.clearCookie(this.REFRESH_COOKIE, this.baseOptions());
  }

static getAccessToken(req: any): string | null {
  const token = req.cookies?.[this.ACCESS_COOKIE] || null;
  console.log("[AUTH-COOKIE] getAccessToken keys:", Object.keys(req.cookies || {}));
  console.log("[AUTH-COOKIE] getAccessToken found?:", Boolean(token));
  return token;
}

  static getRefreshToken(req: any): string | null {
    return req.cookies?.[this.REFRESH_COOKIE] || null;
  }
}
