"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthCookieManager = void 0;
class AuthCookieManager {
    static baseOptions() {
        return {
            httpOnly: true,
            secure: true, // REQUIRED for SameSite=None
            sameSite: "none",
            path: "/",
        };
    }
    static setAuthCookies(res, accessToken, refreshToken) {
        res.cookie(this.ACCESS_COOKIE, accessToken, {
            ...this.baseOptions(),
            maxAge: 1000 * 60 * 15, // 15 mins
        });
        res.cookie(this.REFRESH_COOKIE, refreshToken, {
            ...this.baseOptions(),
            maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
        });
    }
    static clearAuthCookies(res) {
        res.clearCookie(this.ACCESS_COOKIE, this.baseOptions());
        res.clearCookie(this.REFRESH_COOKIE, this.baseOptions());
    }
    static getAccessToken(req) {
        const token = req.cookies?.[this.ACCESS_COOKIE] || null;
        console.log("[AUTH-COOKIE] getAccessToken keys:", Object.keys(req.cookies || {}));
        console.log("[AUTH-COOKIE] getAccessToken found?:", Boolean(token));
        return token;
    }
    static getRefreshToken(req) {
        return req.cookies?.[this.REFRESH_COOKIE] || null;
    }
}
exports.AuthCookieManager = AuthCookieManager;
AuthCookieManager.ACCESS_COOKIE = "access_token";
AuthCookieManager.REFRESH_COOKIE = "refresh_token";
