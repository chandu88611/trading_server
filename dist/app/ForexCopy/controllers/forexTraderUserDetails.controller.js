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
exports.ForexTraderUserDetailsController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const forexTraderUserDetails_service_1 = require("../services/forexTraderUserDetails.service");
const entity_enum_1 = require("../../../entity/entity.enum");
class ForexTraderUserDetailsController {
    constructor() {
        this.service = new forexTraderUserDetails_service_1.ForexTraderUserDetailsService();
    }
    async upsertMyDetails(req, res) {
        const userId = Number(req.auth.userId);
        const { forexTraderUserId, forexType, token, isMaster } = req.body ?? {};
        // basic validations like your style
        if (!forexTraderUserId || !forexType) {
            res.status(400).json({
                message: "forexTraderUserId, forexType and token are required",
            });
            return;
        }
        // ensure forexType is valid enum value
        if (!Object.values(entity_enum_1.ForexTradeCategory).includes(forexType)) {
            res.status(400).json({ message: "Invalid forexType" });
            return;
        }
        if (isMaster !== undefined && typeof isMaster !== "boolean") {
            res.status(400).json({ message: "isMaster must be boolean" });
            return;
        }
        const data = await this.service.upsertMyDetails(userId, {
            forexTraderUserId,
            forexType,
            token,
            isMaster,
        });
        res.status(200).json({ message: "Saved", data });
    }
    async getMyDetails(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getMyDetails(userId);
        res.status(200).json({ message: "ok", data });
    }
    async updateMyDetailById(req, res) {
        const userId = Number(req.auth.userId);
        const id = Number(req.params.id);
        if (!id) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const { forexTraderUserId, token, isMaster } = req.body ?? {};
        if (token !== undefined && token !== null && typeof token !== "string") {
            res.status(400).json({ message: "Invalid token" });
            return;
        }
        if (isMaster !== undefined && typeof isMaster !== "boolean") {
            res.status(400).json({ message: "isMaster must be boolean" });
            return;
        }
        const data = await this.service.updateMyDetailById(userId, id, {
            forexTraderUserId,
            token,
            isMaster,
        });
        res.status(200).json({ message: "Updated", data });
    }
    async deleteMyDetailById(req, res) {
        const userId = Number(req.auth.userId);
        const id = Number(req.params.id);
        if (!id) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const result = await this.service.deleteMyDetailById(userId, id);
        res.status(200).json({ message: "Deleted", data: result });
    }
}
exports.ForexTraderUserDetailsController = ForexTraderUserDetailsController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ForexTraderUserDetailsController.prototype, "upsertMyDetails", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ForexTraderUserDetailsController.prototype, "getMyDetails", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ForexTraderUserDetailsController.prototype, "updateMyDetailById", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ForexTraderUserDetailsController.prototype, "deleteMyDetailById", null);
