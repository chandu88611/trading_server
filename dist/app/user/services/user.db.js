"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const User_1 = require("../../../entity/User");
const AuthProvider_1 = require("../../../entity/AuthProvider");
const RefreshToken_1 = require("../../../entity/RefreshToken");
class UserDBService {
    constructor() {
        this.userRepo = data_source_1.default.getRepository(User_1.User);
        this.authRepo = data_source_1.default.getRepository(AuthProvider_1.AuthProvider);
        this.tokenRepo = data_source_1.default.getRepository(RefreshToken_1.RefreshToken);
    }
    async findByEmail(email) {
        return this.userRepo.findOne({ where: { email } });
    }
    async createUser(payload) {
        const u = this.userRepo.create(payload);
        return this.userRepo.save(u);
    }
    async createAuthProvider(user, provider, providerUserId, meta) {
        const ap = this.authRepo.create({
            user,
            provider,
            provider_user_id: providerUserId,
            provider_meta: meta,
        });
        return this.authRepo.save(ap);
    }
    async saveRefreshToken(user, tokenHash, expiresAt) {
        const rt = this.tokenRepo.create({
            user,
            token_hash: tokenHash,
            expires_at: expiresAt,
        });
        return this.tokenRepo.save(rt);
    }
}
exports.UserDBService = UserDBService;
