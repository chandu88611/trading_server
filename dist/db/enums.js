"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyTradeSideEnum = exports.AddressTypeEnum = exports.SubscriptionStatusEnum = exports.PlanBillingCycleEnum = exports.UserRoleEnum = void 0;
var UserRoleEnum;
(function (UserRoleEnum) {
    UserRoleEnum["USER"] = "USER";
    UserRoleEnum["MASTER"] = "MASTER";
    UserRoleEnum["ADMIN"] = "ADMIN";
})(UserRoleEnum || (exports.UserRoleEnum = UserRoleEnum = {}));
var PlanBillingCycleEnum;
(function (PlanBillingCycleEnum) {
    PlanBillingCycleEnum["MONTHLY"] = "MONTHLY";
    PlanBillingCycleEnum["YEARLY"] = "YEARLY";
})(PlanBillingCycleEnum || (exports.PlanBillingCycleEnum = PlanBillingCycleEnum = {}));
var SubscriptionStatusEnum;
(function (SubscriptionStatusEnum) {
    SubscriptionStatusEnum["ACTIVE"] = "ACTIVE";
    SubscriptionStatusEnum["CANCELLED"] = "CANCELLED";
    SubscriptionStatusEnum["EXPIRED"] = "EXPIRED";
    SubscriptionStatusEnum["PAUSED"] = "PAUSED";
})(SubscriptionStatusEnum || (exports.SubscriptionStatusEnum = SubscriptionStatusEnum = {}));
var AddressTypeEnum;
(function (AddressTypeEnum) {
    AddressTypeEnum["REGISTERED"] = "REGISTERED";
    AddressTypeEnum["CORPORATE"] = "CORPORATE";
    AddressTypeEnum["BILLING"] = "BILLING";
    AddressTypeEnum["BRANCH"] = "BRANCH";
    AddressTypeEnum["WAREHOUSE"] = "WAREHOUSE";
    AddressTypeEnum["OTHER"] = "OTHER";
})(AddressTypeEnum || (exports.AddressTypeEnum = AddressTypeEnum = {}));
var CopyTradeSideEnum;
(function (CopyTradeSideEnum) {
    CopyTradeSideEnum["BUY"] = "BUY";
    CopyTradeSideEnum["SELL"] = "SELL";
})(CopyTradeSideEnum || (exports.CopyTradeSideEnum = CopyTradeSideEnum = {}));
