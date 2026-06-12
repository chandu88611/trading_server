"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOKIE_NAMES = void 0;
exports.setAuthCookies = setAuthCookies;
exports.clearAuthCookies = clearAuthCookies;
exports.COOKIE_NAMES = {
    access: "access_token",
    refresh: "refresh_token",
};
function setAuthCookies(res, accessJwt, refreshJwt) {
    const common = {
        httpOnly: true,
        secure: true, // ✅ must be true for SameSite=None
        sameSite: "none",
        path: "/",
    };
    // access token ttl matches backend JWT lifetime
    res.cookie(exports.COOKIE_NAMES.access, accessJwt, {
        ...common,
        maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    // refresh token longer ttl (example 15 days)
    res.cookie(exports.COOKIE_NAMES.refresh, refreshJwt, {
        ...common,
        maxAge: 1000 * 60 * 60 * 24 * 15,
    });
}
function clearAuthCookies(res) {
    const common = {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
    };
    res.clearCookie(exports.COOKIE_NAMES.access, common);
    res.clearCookie(exports.COOKIE_NAMES.refresh, common);
}
