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
const alertSnapshot_interface_1 = require("../interfaces/alertSnapshot.interface");
class AlertSnapshotController {
    constructor() {
        this.service = new alertSnapshot_service_1.AlertSnapshotService();
    }
    async create(req, res) {
        const payload = req.body;
        const userId = req.auth.userId;
        console.log("Creating alert snapshot for user:", userId, "with payload:", payload);
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
            jobId: req.query.jobId ? Number(req.query.jobId) : undefined,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            lastMinutes: req.query.lastMinutes
                ? Number(req.query.lastMinutes)
                : undefined,
        });
        res.status(200).json({ message: "ok", data });
    }
    async getTimeline(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getAlertTimeline(userId, {
            bucket: (0, alertSnapshot_interface_1.parseTimelineBucket)(req.query.bucket),
            ticker: req.query.ticker || undefined,
            exchange: req.query.exchange || undefined,
            interval: req.query.interval || undefined,
            jobId: req.query.jobId ? Number(req.query.jobId) : undefined,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            lastMinutes: req.query.lastMinutes
                ? Number(req.query.lastMinutes)
                : undefined,
        });
        res.status(200).json({ message: "ok", data });
    }
    async listByJob(req, res) {
        const jobId = Number(req.params.jobId);
        const data = await this.service.listByJob(jobId);
        res.json({ message: "ok", data });
    }
    async getOpenJobs(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getOpenJobs(userId, {
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 20,
            type: req.query.type || undefined,
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
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "getTimeline", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "listByJob", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "getOpenJobs", null);
