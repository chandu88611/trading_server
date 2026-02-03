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
exports.BrokerEvent = void 0;
const typeorm_1 = require("typeorm");
const BrokerJob_1 = require("./BrokerJob");
let BrokerEvent = class BrokerEvent {
};
exports.BrokerEvent = BrokerEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BrokerEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BrokerJob_1.BrokerJob, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "job_id" }),
    __metadata("design:type", BrokerJob_1.BrokerJob)
], BrokerEvent.prototype, "job", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "event_type", type: "text" }),
    __metadata("design:type", String)
], BrokerEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], BrokerEvent.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], BrokerEvent.prototype, "createdAt", void 0);
exports.BrokerEvent = BrokerEvent = __decorate([
    (0, typeorm_1.Entity)({ name: "broker_events" })
], BrokerEvent);
