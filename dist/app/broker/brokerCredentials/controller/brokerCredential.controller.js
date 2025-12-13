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
exports.BrokerCredentialController = void 0;
const brokerCredential_service_1 = require("../services/brokerCredential.service");
const error_handler_1 = require("../../../../types/error-handler");
class BrokerCredentialController {
    constructor() {
        this.service = new brokerCredential_service_1.BrokerCredentialService();
    }
    async create(req, res) {
        const payload = req.body;
        const created = await this.service.create(payload);
        res.status(201).json({ message: "created", data: created });
    }
    async listByUser(req, res) {
        const userId = Number(req.params.userId) || req.auth?.id;
        const data = await this.service.listByUser(userId);
        res.json({ message: "ok", data });
    }
    async get(req, res) {
        const id = Number(req.params.id);
        const data = await this.service.get(id);
        res.json({ message: "ok", data });
    }
    async update(req, res) {
        const id = Number(req.params.id);
        const payload = req.body;
        const data = await this.service.update(id, payload);
        res.json({ message: "updated", data });
    }
    async remove(req, res) {
        const id = Number(req.params.id);
        await this.service.delete(id);
        res.json({ message: "deleted" });
    }
}
exports.BrokerCredentialController = BrokerCredentialController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerCredentialController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerCredentialController.prototype, "listByUser", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerCredentialController.prototype, "get", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerCredentialController.prototype, "update", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerCredentialController.prototype, "remove", null);
