"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerJobDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const entity_1 = require("../../../../entity");
class BrokerJobDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(entity_1.BrokerJob);
        this.credRepo = data_source_1.default.getRepository(entity_1.BrokerCredential);
    }
    async getOrCreateBrokerJobId(payload, queryRunner) {
        try {
            // const cred = await this.credRepo.findOne({
            //   where: { id: payload.credentialId },
            // });
            // if (!cred) throw new Error("credential_not_found");
            // const entity = queryRunner.manager.getRepository(BrokerJob).create({
            //   credential: { id: payload.credentialId } as BrokerCredential,
            //   type: payload.type,
            //   payload: payload.payload ?? null,
            //   status: "pending",
            //   attempts: 0,
            // });
            // console.log("Creating broker job entity:", entity, payload);
            // let data = await queryRunner.manager
            //   .getRepository(BrokerJob)
            //   .save(entity);
            //   console.log("Saved broker job data:", data);
            // return data?.id;
            return 0;
        }
        catch (error) {
            console.error("Error in getOrCreateBrokerJobId:", error);
            throw error;
        }
    }
    async create(payload) {
        const cred = await this.credRepo.findOne({
            where: { id: payload.credentialId },
        });
        if (!cred)
            throw new Error("credential_not_found");
        // const entity = this.repo.create({
        //   credential: { id: payload.credentialId } as BrokerCredential,
        //   type: payload.type,
        //   payload: payload.payload ?? null,
        //   status: "pending",
        //   attempts: 0,
        // });
        return this.repo.save({});
    }
    async update(id, payload) {
        await this.repo.update({ id }, {
            payload: payload.payload,
            attempts: payload.attempts,
            lastError: payload.lastError,
            status: payload.status,
        });
        return this.repo.findOne({ where: { id } });
    }
    async getById(id) {
        return this.repo.findOne({
            where: { id },
            relations: ["credential", "alertSnapshots", "tradeSignals"],
        });
    }
    async listByCredential(credentialId) {
        // return this.repo.find({
        //   where: { credentialId : { id: credentialId } },
        //   order: { createdAt: "DESC" },
        // });
    }
    async listPending(limit = 50) {
        return this.repo.find({
            where: { status: "pending" },
            order: { createdAt: "ASC" },
            take: limit,
        });
    }
}
exports.BrokerJobDB = BrokerJobDB;
