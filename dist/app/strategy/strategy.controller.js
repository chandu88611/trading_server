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
exports.StrategyController = void 0;
const error_handler_1 = require("../../types/error-handler");
const strategy_1 = require("./strategy");
class StrategyController {
    constructor() {
        this.service = new strategy_1.StrategyService();
    }
    async create(req, res) {
        const s = await this.service.create(req.body);
        res.status(201).json({ message: "Strategy created", data: s });
    }
    async listActive(req, res) {
        const data = await this.service.list({ isActive: true });
        res.status(200).json({ message: "Fetched strategies", data });
    }
}
exports.StrategyController = StrategyController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "listActive", null);
