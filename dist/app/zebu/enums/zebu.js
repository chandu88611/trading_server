"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebuAuthMode = exports.ZebuTradeStatus = void 0;
var ZebuTradeStatus;
(function (ZebuTradeStatus) {
    ZebuTradeStatus["PENDING"] = "pending";
    ZebuTradeStatus["PROCESSING"] = "processing";
    ZebuTradeStatus["EXECUTED"] = "executed";
    ZebuTradeStatus["FAILED"] = "failed";
})(ZebuTradeStatus || (exports.ZebuTradeStatus = ZebuTradeStatus = {}));
var ZebuAuthMode;
(function (ZebuAuthMode) {
    ZebuAuthMode["PASTE_TOKEN"] = "PASTE_TOKEN";
})(ZebuAuthMode || (exports.ZebuAuthMode = ZebuAuthMode = {}));
