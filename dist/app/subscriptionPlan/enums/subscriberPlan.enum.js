"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanStatus = exports.BillingInterval = void 0;
var BillingInterval;
(function (BillingInterval) {
    BillingInterval["MONTHLY"] = "monthly";
    BillingInterval["YEARLY"] = "yearly";
})(BillingInterval || (exports.BillingInterval = BillingInterval = {}));
var PlanStatus;
(function (PlanStatus) {
    PlanStatus["ACTIVE"] = "active";
    PlanStatus["INACTIVE"] = "inactive";
})(PlanStatus || (exports.PlanStatus = PlanStatus = {}));
