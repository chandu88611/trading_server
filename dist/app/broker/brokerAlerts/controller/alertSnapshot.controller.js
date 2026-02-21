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
exports.AlertSnapshotController = void 0;
const alertSnapshot_service_1 = require("../services/alertSnapshot.service");
const error_handler_1 = require("../../../../types/error-handler");
class AlertSnapshotController {
    constructor() {
        this.service = new alertSnapshot_service_1.AlertSnapshotService();
    }
    async create(req, res) {
        const payload = req.body;
        const userId = req.auth.userId;
        const fullPayload = { ...payload, userId };
        const s = await this.service.create(fullPayload);
        res.status(201).json({ message: "created", data: s });
    }
    async getHistory(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getAlertHistory(userId, {
            page: Number(req.query.page ?? 1),
            limit: Number(req.query.limit ?? 20),
            ticker: req.query.ticker || undefined,
            exchange: req.query.exchange || undefined,
            interval: req.query.interval || undefined,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            lastMinutes: req.query.lastMinutes
                ? Number(req.query.lastMinutes)
                : undefined,
        });
        res.status(200).json({ message: "ok", data });
    }
}
exports.AlertSnapshotController = AlertSnapshotController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "getHistory", null);
