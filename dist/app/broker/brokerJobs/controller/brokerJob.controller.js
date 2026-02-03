"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerJobController = void 0;
const brokerJob_service_1 = require("../services/brokerJob.service");
const error_handler_1 = require("../../../../types/error-handler");
class BrokerJobController {
    constructor() {
        this.service = new brokerJob_service_1.BrokerJobService();
    }
    async create(req, res) {
        const payload = req.body;
        const job = await this.service.create(payload);
        res.status(201).json({ message: "created", data: job });
    }
    async get(req, res) {
        const id = Number(req.params.id);
        const job = await this.service.getById(id);
        res.json({ message: "ok", data: job });
    }
    async listByCredential(req, res) {
        const credentialId = Number(req.params.credentialId);
        const jobs = await this.service.listByCredential(credentialId);
        res.json({ message: "ok", data: jobs });
    }
    async listPending(req, res) {
        const limit = Number(req.query.limit) || 50;
        const jobs = await this.service.listPending(limit);
        res.json({ message: "ok", data: jobs });
    }
    async update(req, res) {
        const id = Number(req.params.id);
        const payload = req.body;
        const job = await this.service.update(id, payload);
        res.json({ message: "updated", data: job });
    }
}
exports.BrokerJobController = BrokerJobController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerJobController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerJobController.prototype, "get", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerJobController.prototype, "listByCredential", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerJobController.prototype, "listPending", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerJobController.prototype, "update", null);
