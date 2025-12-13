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
exports.SubscriptionPlanController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const subscriptionPlan_1 = require("../services/subscriptionPlan");
class SubscriptionPlanController {
    constructor() {
        this.service = new subscriptionPlan_1.SubscriptionPlanService();
    }
    async createPlan(req, res) {
        const payload = req.body;
        const plan = await this.service.createPlan(payload);
        res.status(201).json({
            message: "Subscription plan created",
            data: plan,
        });
    }
    async getPlan(req, res) {
        const id = Number(req.params.planId);
        const plan = await this.service.getPlan(id);
        res.status(200).json({ message: "Fetched", data: plan });
    }
    async updatePlan(req, res) {
        const id = Number(req.params.planId);
        const payload = req.body;
        await this.service.updatePlan(id, payload);
        res.status(200).json({ message: "Updated successfully" });
    }
    async deletePlan(req, res) {
        const id = Number(req.params.planId);
        await this.service.deletePlan(id);
        res.status(200).json({ message: "Subscription plan deleted" });
    }
    async getAll(req, res) {
        const query = req.query;
        const data = await this.service.getPlans(query);
        res.status(200).json({ message: "Fetched all plans", data });
    }
    async getActive(req, res) {
        const plans = await this.service.getActivePlans();
        res.status(200).json({ message: "Fetched active plans", data: plans });
    }
}
exports.SubscriptionPlanController = SubscriptionPlanController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "createPlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "getPlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "updatePlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "deletePlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "getAll", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "getActive", null);
