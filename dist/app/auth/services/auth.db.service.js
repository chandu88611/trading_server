"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const User_1 = require("../../../entity/User");
class AuthDBService {
    constructor() {
        this.userRepo = data_source_1.default.getRepository(User_1.User);
    }
    async findByEmail(email) {
        return this.userRepo.findOne({
            where: { email },
        });
    }
    async createUser(user) {
        return this.userRepo.save(this.userRepo.create(user));
    }
    async setVerificationToken(userId, tokenHash) {
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
}
exports.AuthDBService = AuthDBService;
