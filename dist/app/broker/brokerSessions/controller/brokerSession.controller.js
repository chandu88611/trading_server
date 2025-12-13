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
exports.BrokerSessionController = void 0;
const brokerSession_service_1 = require("../services/brokerSession.service");
const error_handler_1 = require("../../../../types/error-handler");
class BrokerSessionController {
    constructor() {
        this.service = new brokerSession_service_1.BrokerSessionService();
    }
    async create(req, res) {
        const payload = req.body;
        const s = await this.service.create(payload);
        res.status(201).json({ message: "created", data: s });
    }
    async listValid(req, res) {
        const credentialId = Number(req.params.credentialId);
        const data = await this.service.getValidSessions(credentialId);
        res.json({ message: "ok", data });
    }
    async revokeAll(req, res) {
        const credentialId = Number(req.params.credentialId);
        await this.service.revokeAll(credentialId);
        res.json({ message: "revoked" });
    }
}
exports.BrokerSessionController = BrokerSessionController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerSessionController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerSessionController.prototype, "listValid", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerSessionController.prototype, "revokeAll", null);
