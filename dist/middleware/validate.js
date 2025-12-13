"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRegister = validateRegister;
function validateRegister(req, res, next) {
    const { provider, providerUserId, email, password, name } = req.body ?? {};
    // If provider provided (google), require providerUserId
    if (provider) {
        if (!providerUserId)
            return res
                .status(400)
                .json({ message: "providerUserId is required for provider signup" });
        return next();
    }
    // Else require email & password
    if (!email || typeof email !== "string")
        return res.status(400).json({ message: "email is required" });
    if (!password || typeof password !== "string" || password.length < 8)
        return res
            .status(400)
            .json({ message: "password must be at least 8 characters" });
    // attach normalized values
    req.body.email = email.toLowerCase();
    req.body.name = typeof name === "string" ? name : undefined;
    next();
}
exports.default = { validateRegister };
