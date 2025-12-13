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
exports.BrokerEventController = void 0;
const brokerEvent_service_1 = require("../services/brokerEvent.service");
const error_handler_1 = require("../../../../types/error-handler");
class BrokerEventController {
    constructor() {
        this.service = new brokerEvent_service_1.BrokerEventService();
    }
    async create(req, res) {
        const payload = req.body;
        const ev = await this.service.create(payload);
        res.status(201).json({ message: "created", data: ev });
    }
    async listByJob(req, res) {
        const jobId = Number(req.params.jobId);
        const data = await this.service.listByJob(jobId);
        res.json({ message: "ok", data });
    }
}
exports.BrokerEventController = BrokerEventController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerEventController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerEventController.prototype, "listByJob", null);
