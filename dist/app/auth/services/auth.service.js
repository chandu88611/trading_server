"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const email_service_1 = require("../../../types/email.service");
const token_1 = require("../../../types/token");
const auth_db_service_1 = require("./auth.db.service");
class AuthService {
    constructor() {
        this.authDB = new auth_db_service_1.AuthDBService();
    }
    async registerUser(email) {
        const existingUser = await this.authDB.findByEmail(email);
        // Do NOT reveal whether user exists
        if (existingUser && existingUser.isEmailVerified) {
            return;
        }
        const rawToken = (0, token_1.generateRawToken)();
        const tokenHash = (0, token_1.hashToken)(rawToken);
        let userId;
        if (!existingUser) {
            const user = await this.authDB.createUser({
                email,
                passwordHash: "TEMP_BLOCKED", // replace with real hash later
                isEmailVerified: false,
            });
            userId = user.id;
        }
        else {
            userId = existingUser.id;
        }
        await this.authDB.setVerificationToken(userId, tokenHash);
        await (0, email_service_1.sendVerificationEmail)({
            email,
            token: rawToken,
        });
    }
    async verifyEmail(token) {
        const tokenHash = (0, token_1.hashToken)(token);
        const user = await this.authDB.findByVerificationToken(tokenHash);
        if (!user) {
            throw new Error("Invalid or expired verification token");
        }
        await this.authDB.markEmailVerified(user.id);
    }
}
exports.AuthService = AuthService;
