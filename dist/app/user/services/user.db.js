"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserDBService = void 0;
// src/app/user/services/user.db.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const User_1 = require("../../../entity/User");
const AuthProvider_1 = require("../../../entity/AuthProvider");
const RefreshToken_1 = require("../../../entity/RefreshToken");
const constants_1 = require("../../../types/constants");
const UserBillingDetails_1 = require("../../../entity/UserBillingDetails");
const UserEdgingStatus_1 = require("../../../entity/UserEdgingStatus");
class UserDBService {
    constructor() {
        this.userRepo = data_source_1.default.getRepository(User_1.User);
        this.authRepo = data_source_1.default.getRepository(AuthProvider_1.AuthProvider);
        this.tokenRepo = data_source_1.default.getRepository(RefreshToken_1.RefreshToken);
        this.billingRepo = data_source_1.default.getRepository(UserBillingDetails_1.UserBillingDetails);
        this.edgingRepo = data_source_1.default.getRepository(UserEdgingStatus_1.UserEdgingStatus);
    }
    async findByEmail(email) {
        return this.userRepo.findOne({ where: { email } });
    }
    async findById(id) {
        return this.userRepo.findOne({ where: { id } });
    }
    async getProvider(userId) {
        return this.authRepo.findOne({ where: { userId } });
    }
    async createUser(params) {
        const u = this.userRepo.create({
            email: params.email,
            name: params.name ?? null,
            passwordHash: params.passwordHash,
            isEmailVerified: params.isEmailVerified ?? false,
            isActive: true,
        });
        return this.userRepo.save(u);
    }
    async createAuthProvider(user, provider, providerUserId, meta) {
        const ap = this.authRepo.create({
            user,
            userId: user.id,
            provider,
            providerUserId: `${providerUserId}`,
            providerMeta: meta,
        });
        return this.authRepo.save(ap);
    }
    // ========= REFRESH TOKENS ==========
    async saveRefreshToken(user, tokenHash, expiresAt) {
        const rt = this.tokenRepo.create({
            user,
            userId: user.id,
            tokenHash,
            expiresAt: expiresAt ?? null,
            revoked: false,
        });
        return this.tokenRepo.save(rt);
    }
    async findRefreshTokenByHash(tokenHash) {
        return this.tokenRepo.findOne({
            where: { tokenHash },
            relations: ["user"],
        });
    }
    async findRefreshTokenForUser(userId, tokenHash) {
        return this.tokenRepo.findOne({
            where: { tokenHash, userId },
            relations: ["user"],
        });
    }
    async revokeRefreshTokenByHash(tokenHash) {
        await this.tokenRepo.update({ tokenHash }, { revoked: true });
    }
    async revokeAllRefreshTokensForUser(userId) {
        await this.tokenRepo.update({ userId }, { revoked: true });
    }
    async setEmailVerificationToken(userId, tokenHash) {
        await this.userRepo.update({ id: userId }, { verificationToken: tokenHash });
    }
    async findByVerificationToken(tokenHash) {
        return this.userRepo.findOne({
            where: {
                verificationToken: tokenHash,
                isEmailVerified: false,
            },
        });
    }
    async markEmailVerified(userId) {
        await this.userRepo.update({ id: userId }, {
            isEmailVerified: true,
            verificationToken: null,
        });
    }
    async getUserDetails(userId) {
        try {
            let userData = await this.userRepo.findOne({
                where: { id: userId },
                select: [
                    "id",
                    "email",
                    "name",
                    "isEmailVerified",
                    "isActive",
                    "isAdmin",
                    "allowTrade",
                    "createdAt",
                    "updatedAt",
                ],
            });
            if (!userData) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            else {
                return userData;
            }
        }
        catch (error) {
            throw error;
        }
    }
    async getBillingDetails(userId) {
        try {
            return this.billingRepo.findOne({
                where: { userId: String(userId) },
            });
        }
        catch (error) {
            throw error;
        }
    }
    async upsertBillingDetails(userId, payload) {
        try {
            const existing = await this.billingRepo.findOne({
                where: { userId: String(userId) },
            });
            if (existing) {
                // update only provided fields (don’t wipe with undefined)
                Object.entries(payload).forEach(([k, v]) => {
                    if (v !== undefined)
                        existing[k] = v;
                });
                // never allow changing userId
                existing.userId = String(userId);
                return this.billingRepo.save(existing);
            }
            const created = this.billingRepo.create({
                userId: String(userId),
                panNumber: payload.panNumber ?? null,
                accountHolderName: payload.accountHolderName ?? null,
                accountNumber: payload.accountNumber ?? null,
                ifscCode: payload.ifscCode ?? null,
                bankName: payload.bankName ?? null,
                branch: payload.branch ?? null,
                addressLine1: payload.addressLine1 ?? null,
                addressLine2: payload.addressLine2 ?? null,
                city: payload.city ?? null,
                state: payload.state ?? null,
                pincode: payload.pincode ?? null,
            });
            return this.billingRepo.save(created);
        }
        catch (error) {
            throw error;
        }
    }
    async updateTradeStatus(userId, allowTrade) {
        try {
            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            user.allowTrade = allowTrade;
            return this.userRepo.save(user);
        }
        catch (error) {
            throw error;
        }
    }
    async updateCopyTradeStatus(userId, allowCopyTrade) {
        try {
            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            user.allowCopyTrade = allowCopyTrade;
            return this.userRepo.save(user);
        }
        catch (error) {
            throw error;
        }
    }
    async getEdgingStatus(userId) {
        try {
            let edging = await this.edgingRepo.findOne({
                where: { userId: String(userId) },
            });
            if (!edging) {
                edging = this.edgingRepo.create({
                    userId: String(userId),
                    isEnabled: false,
                    notes: null,
                });
                edging = await this.edgingRepo.save(edging);
            }
            return edging;
        }
        catch (error) {
            throw error;
        }
    }
    async upsertEdgingStatus(userId, isEnabled, notes) {
        try {
            let edging = await this.edgingRepo.findOne({
                where: { userId: String(userId) },
            });
            if (!edging) {
                edging = this.edgingRepo.create({
                    userId: String(userId),
                    isEnabled,
                    notes: notes ?? null,
                });
            }
            else {
                edging.isEnabled = isEnabled;
                if (notes !== undefined) {
                    edging.notes = notes;
                }
            }
            return this.edgingRepo.save(edging);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.UserDBService = UserDBService;
