"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeAction = void 0;
exports.parseTimelineBucket = parseTimelineBucket;
var TradeAction;
(function (TradeAction) {
    TradeAction["SELL"] = "SELL";
    TradeAction["BUY"] = "BUY";
    TradeAction["HOLD"] = "HOLD";
})(TradeAction || (exports.TradeAction = TradeAction = {}));
function parseTimelineBucket(v) {
    const s = String(v ?? "").trim();
    switch (s) {
        case "1m":
        case "5m":
        case "15m":
        case "1h":
        case "1d":
            return s;
        default:
            return "15m";
    }
}
