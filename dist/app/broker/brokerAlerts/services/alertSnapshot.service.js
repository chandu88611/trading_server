"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotService = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const constants_1 = require("../../../../types/constants");
const trade_identify_1 = require("../../../../types/trade-identify");
// import { CopyTradingService } from "../../../copyTrading/services/copyTrading.service";
// import { CTraderService } from "../../../cTraderListener/services/cTrader";
const userSubscription_1 = require("../../../userSubscription/services/userSubscription");
const userSubscription_db_1 = require("../../../userSubscription/services/userSubscription.db");
const tradeSignal_service_1 = require("../../brokerSignals/services/tradeSignal.service");
const alertSnapshot_db_1 = require("./alertSnapshot.db");
const tradingAccount_service_1 = require("../../../tradingAccount/services/tradingAccount.service");
const user_db_1 = require("../../../user/services/user.db");
const subscriptionPlan_1 = require("../../../subscriptionPlan/services/subscriptionPlan");
const subscriberPlan_enum_1 = require("../../../subscriptionPlan/enums/subscriberPlan.enum");
const planStrategy_1 = require("../../../subscriptionPlan/utils/planStrategy");
const distanceMapping_service_1 = require("../../../trade/services/distanceMapping.service");
const adminStrategyTradeSchedule_util_1 = require("../../../user/utils/adminStrategyTradeSchedule.util");
const indianOptionResolver_service_1 = require("../../../india/options/indianOptionResolver.service");
class AlertSnapshotService {
    constructor() {
        this.alertSnapshotDB = new alertSnapshot_db_1.AlertSnapshotDB();
        this.tradeSignalService = new tradeSignal_service_1.TradeSignalService();
        this.userSubscriptionService = new userSubscription_1.UserSubscriptionService();
        this.userSubscriptionDbService = new userSubscription_db_1.UserSubscriptionDBService();
        // this.copyTradingService = new CopyTradingService();
        // this.cTraderService = new CTraderService();
        this.tradingAccountService = new tradingAccount_service_1.TradingAccountService();
        this.userDBService = new user_db_1.UserDBService();
        this.subscriptionPlanService = new subscriptionPlan_1.SubscriptionPlanService();
        this.distanceMappingService = new distanceMapping_service_1.DistanceMappingService();
        this.optionResolver = new indianOptionResolver_service_1.IndianOptionResolverService();
    }
    normalizeSimplifiedLuxAlert(payload) {
        const strategy = String(payload.strategy ?? "").trim().toUpperCase();
        const isSimpleLux = strategy.includes("LUX") || payload.lots !== undefined;
        if (!isSimpleLux)
            return payload;
        const now = new Date();
        const close = Number(payload.close);
        const safeClose = Number.isFinite(close) ? close : 0;
        const ticker = String(payload.ticker ?? "").trim().toUpperCase();
        const action = String(payload.action ?? "").trim().toUpperCase();
        const rawMarket = String(payload.market ?? "").trim().toUpperCase();
        const rawExchange = String(payload.exchange ?? "").trim().toUpperCase();
        const inferredMarket = rawMarket === trade_identify_1.MarketType.CRYPTO ||
            rawMarket === "CRYPTO" ||
            rawMarket === "CRYPTOCURRENCY"
            ? trade_identify_1.MarketType.CRYPTO
            : rawMarket === trade_identify_1.MarketType.FOREX ||
                rawMarket === "FOREX" ||
                rawMarket === "FX"
                ? trade_identify_1.MarketType.FOREX
                : rawMarket === trade_identify_1.MarketType.INDIAN ||
                    rawMarket === "INDIAN" ||
                    rawMarket === "INDIA"
                    ? trade_identify_1.MarketType.INDIAN
                    : this.inferMarketFromTickerAndExchange(ticker, rawExchange);
        const defaultExchange = inferredMarket === trade_identify_1.MarketType.CRYPTO
            ? "CRYPTO"
            : inferredMarket === trade_identify_1.MarketType.FOREX
                ? "FOREX"
                : "NSE";
        return {
            ...payload,
            market: (payload.market ?? inferredMarket),
            exchange: payload.exchange ?? defaultExchange,
            interval: payload.interval ?? "signal",
            barTime: payload.barTime ? new Date(payload.barTime) : now,
            alertTime: payload.alertTime ? new Date(payload.alertTime) : now,
            open: payload.open ?? safeClose,
            close: safeClose,
            high: payload.high ?? safeClose,
            low: payload.low ?? safeClose,
            volume: payload.volume ?? Number(payload.lots ?? 0),
            tradingStrength: payload.tradingStrength ?? 100,
            executionMode: payload.executionMode ?? "OPEN",
            entryRef: payload.entryRef ??
                `lux-${ticker || "unknown"}-${action || "signal"}-${now.getTime()}`.slice(0, 100),
            orderType: payload.orderType ?? "MARKET",
        };
    }
    inferMarketFromTickerAndExchange(ticker, exchange) {
        const normalizedTicker = String(ticker ?? "").trim().toUpperCase();
        const normalizedExchange = String(exchange ?? "").trim().toUpperCase();
        const cryptoExchanges = new Set([
            "CRYPTO",
            "COINDCX",
            "DELTA",
            "DELTA_EXCHANGE",
            "BINANCE",
            "BYBIT",
            "OKX",
        ]);
        if (cryptoExchanges.has(normalizedExchange)) {
            return trade_identify_1.MarketType.CRYPTO;
        }
        if (normalizedTicker.endsWith("USDT") ||
            normalizedTicker.endsWith("USDC") ||
            normalizedTicker.endsWith("BTC") ||
            normalizedTicker.endsWith("ETH") ||
            normalizedTicker.includes("BTC") ||
            normalizedTicker.includes("ETH")) {
            return trade_identify_1.MarketType.CRYPTO;
        }
        if (normalizedExchange === "FOREX" ||
            normalizedExchange === "FX" ||
            /^[A-Z]{6}$/.test(normalizedTicker)) {
            return trade_identify_1.MarketType.FOREX;
        }
        return trade_identify_1.MarketType.INDIAN;
    }
    normalizeAction(action) {
        const normalized = String(action ?? "").trim().toUpperCase();
        if (normalized === "BUY")
            return "BUY";
        if (normalized === "SELL")
            return "SELL";
        return null;
    }
    normalizeTradingStrength(value) {
        if (value === undefined || value === null)
            return null;
        if (typeof value === "number") {
            if (!Number.isFinite(value)) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_trading_strength",
                };
            }
            return value;
        }
        const normalized = String(value).trim();
        if (!normalized)
            return null;
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_trading_strength",
            };
        }
        return parsed;
    }
    hasManagedTrailingTakeProfit(payload) {
        return (payload.trailingTakeProfitActivationDistance !== undefined &&
            payload.trailingTakeProfitActivationDistance !== null) || (payload.trailingTakeProfitDistance !== undefined &&
            payload.trailingTakeProfitDistance !== null);
    }
    hasManagedStopLossProtection(payload) {
        return (payload.breakEvenActivationDistance !== undefined &&
            payload.breakEvenActivationDistance !== null) || (payload.breakEvenOffsetDistance !== undefined &&
            payload.breakEvenOffsetDistance !== null) || (payload.trailingStopLossDistance !== undefined &&
            payload.trailingStopLossDistance !== null);
    }
    isIndianOpenExecution(payload) {
        return payload.market === trade_identify_1.MarketType.INDIAN && this.normalizeExecutionMode(payload) === "OPEN";
    }
    rejectUnsupportedIndianProtectionFields(payload) {
        if (!this.isIndianOpenExecution(payload))
            return;
        const orderType = this.normalizeOrderType(payload.orderType);
        if (orderType === "MARKET_RANGE") {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_unsupported_order_type",
            };
        }
        if (payload.stopLossAmount !== undefined && payload.stopLossAmount !== null) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_rejects_stop_loss_amount",
            };
        }
        if (payload.takeProfitAmount !== undefined && payload.takeProfitAmount !== null) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_rejects_take_profit_amount",
            };
        }
        if (this.hasManagedTrailingTakeProfit(payload)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_rejects_trailing_take_profit",
            };
        }
    }
    hasExtendedExecutionFields(payload) {
        return [
            payload.executionMode,
            payload.entryRef,
            payload.orderType,
            payload.limitPrice,
            payload.stopPrice,
            payload.stopLoss,
            payload.takeProfit,
            payload.stopLossDistance,
            payload.takeProfitDistance,
            payload.stopLossAmount,
            payload.takeProfitAmount,
            payload.trailingStopLoss,
            payload.guaranteedStopLoss,
            payload.stopLossTriggerMethod,
            payload.trailingTakeProfitActivationDistance,
            payload.trailingTakeProfitDistance,
            payload.breakEvenActivationDistance,
            payload.breakEvenOffsetDistance,
            payload.trailingStopLossDistance,
        ].some((value) => value !== undefined && value !== null && value !== "");
    }
    normalizeExecutionMode(payload) {
        const raw = String(payload.executionMode ?? "").trim().toUpperCase();
        if (raw === "OPEN" || raw === "AMEND_SLTP")
            return raw;
        return this.hasExtendedExecutionFields(payload) ? "OPEN" : null;
    }
    normalizeOrderType(orderType) {
        const normalized = String(orderType ?? "").trim().toUpperCase();
        if (normalized === "MARKET" ||
            normalized === "LIMIT" ||
            normalized === "STOP" ||
            normalized === "STOP_LIMIT" ||
            normalized === "MARKET_RANGE") {
            return normalized;
        }
        return null;
    }
    normalizeStopLossTriggerMethod(value) {
        const normalized = String(value ?? "").trim().toUpperCase();
        if (normalized === "TRADE" ||
            normalized === "OPPOSITE" ||
            normalized === "DOUBLE_TRADE" ||
            normalized === "DOUBLE_OPPOSITE") {
            return normalized;
        }
        return null;
    }
    normalizePositiveIntegerDistance(value, field) {
        if (value === undefined || value === null || value === "")
            return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: `invalid_${field}`,
            };
        }
        return parsed;
    }
    normalizeRuleDistance(value, field, options) {
        if (value === undefined || value === null || value === "")
            return null;
        const parsed = Number(value);
        const allowZero = options?.allowZero === true;
        const valid = Number.isFinite(parsed) && Number.isInteger(parsed) && (allowZero ? parsed >= 0 : parsed > 0);
        if (!valid) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: `invalid_${field}`,
            };
        }
        return parsed;
    }
    tryNormalizeLegacyAmountAsDistance(symbol, value) {
        if (value === undefined || value === null || value === "")
            return null;
        try {
            return this.distanceMappingService.resolve({
                broker: "CTRADER",
                symbol: String(symbol ?? ""),
                requestedDistance: value,
            }).requestedDistance;
        }
        catch {
            return null;
        }
    }
    normalizeLegacyLogicalDistanceAliases(payload) {
        const normalizedPayload = { ...payload };
        const normalizedStopLossDistance = normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null
            ? null
            : this.tryNormalizeLegacyAmountAsDistance(normalizedPayload.ticker, normalizedPayload.stopLossAmount);
        const normalizedTakeProfitDistance = normalizedPayload.takeProfitDistance !== undefined && normalizedPayload.takeProfitDistance !== null
            ? null
            : this.tryNormalizeLegacyAmountAsDistance(normalizedPayload.ticker, normalizedPayload.takeProfitAmount);
        if (normalizedStopLossDistance !== null) {
            normalizedPayload.stopLossDistance = normalizedStopLossDistance;
            normalizedPayload.stopLossAmount = null;
        }
        if (normalizedTakeProfitDistance !== null) {
            normalizedPayload.takeProfitDistance = normalizedTakeProfitDistance;
            normalizedPayload.takeProfitAmount = null;
        }
        if (normalizedStopLossDistance !== null || normalizedTakeProfitDistance !== null) {
            console.log("[ALERT] normalized legacy amount fields into logical distance inputs", {
                ticker: normalizedPayload.ticker ?? null,
                stopLossDistance: normalizedPayload.stopLossDistance ?? null,
                takeProfitDistance: normalizedPayload.takeProfitDistance ?? null,
            });
        }
        return normalizedPayload;
    }
    normalizeManagedProtectionAliases(payload) {
        const normalizedPayload = { ...payload };
        if (normalizedPayload.breakEvenActivationDistance === undefined) {
            normalizedPayload.breakEvenActivationDistance =
                normalizedPayload.breakEvenAfterPips ??
                    normalizedPayload.moveStopLossToBreakEvenAfterPips;
        }
        if (normalizedPayload.breakEvenOffsetDistance === undefined) {
            normalizedPayload.breakEvenOffsetDistance = normalizedPayload.breakEvenOffsetPips;
        }
        if (normalizedPayload.trailingStopLossDistance === undefined) {
            normalizedPayload.trailingStopLossDistance = normalizedPayload.trailingStopDistancePips;
        }
        return normalizedPayload;
    }
    validateAndNormalizeExecutionFields(payload) {
        this.rejectUnsupportedIndianProtectionFields(payload);
        const legacyNormalizedPayload = payload.market === trade_identify_1.MarketType.INDIAN ? payload : this.normalizeLegacyLogicalDistanceAliases(payload);
        const normalizedPayload = this.normalizeManagedProtectionAliases(legacyNormalizedPayload);
        const executionMode = this.normalizeExecutionMode(normalizedPayload);
        const normalizedTradingStrength = this.normalizeTradingStrength(normalizedPayload.tradingStrength);
        const hasTrailingTakeProfit = this.hasManagedTrailingTakeProfit(normalizedPayload);
        const hasStopLossProtection = this.hasManagedStopLossProtection(normalizedPayload);
        const hasNativeStopLoss = normalizedPayload.stopLoss !== undefined && normalizedPayload.stopLoss !== null ||
            normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null ||
            normalizedPayload.stopLossAmount !== undefined && normalizedPayload.stopLossAmount !== null;
        const hasNativeTakeProfit = normalizedPayload.takeProfit !== undefined && normalizedPayload.takeProfit !== null ||
            normalizedPayload.takeProfitDistance !== undefined && normalizedPayload.takeProfitDistance !== null ||
            normalizedPayload.takeProfitAmount !== undefined && normalizedPayload.takeProfitAmount !== null;
        if (!executionMode) {
            return {
                ...normalizedPayload,
                tradingStrength: normalizedTradingStrength,
            };
        }
        const entryRef = String(normalizedPayload.entryRef ?? "").trim();
        if (!entryRef) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "entry_ref_required",
            };
        }
        if (entryRef.length > 100) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "entry_ref_too_long",
            };
        }
        if (hasNativeTakeProfit && hasTrailingTakeProfit) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "native_take_profit_conflicts_with_trailing_take_profit",
            };
        }
        if (hasTrailingTakeProfit) {
            const activation = normalizedPayload.trailingTakeProfitActivationDistance;
            const distance = normalizedPayload.trailingTakeProfitDistance;
            if (activation === undefined ||
                activation === null ||
                distance === undefined ||
                distance === null) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "trailing_take_profit_fields_must_be_provided_together",
                };
            }
        }
        let normalizedBreakEvenActivationDistance = null;
        let normalizedBreakEvenOffsetDistance = null;
        let normalizedTrailingStopLossDistance = null;
        if (hasStopLossProtection) {
            if (normalizedPayload.trailingStopLoss === true) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "native_trailing_stop_loss_conflicts_with_managed_stop_loss_protection",
                };
            }
            normalizedBreakEvenActivationDistance = this.normalizeRuleDistance(normalizedPayload.breakEvenActivationDistance, "breakEvenActivationDistance");
            if (normalizedBreakEvenActivationDistance === null) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "break_even_activation_distance_required",
                };
            }
            normalizedBreakEvenOffsetDistance = this.normalizeRuleDistance(normalizedPayload.breakEvenOffsetDistance ?? 0, "breakEvenOffsetDistance", { allowZero: true });
            normalizedTrailingStopLossDistance = this.normalizeRuleDistance(normalizedPayload.trailingStopLossDistance, "trailingStopLossDistance");
        }
        const normalizedOrderType = this.normalizeOrderType(normalizedPayload.orderType) ?? (executionMode === "OPEN" ? "MARKET" : null);
        if (normalizedPayload.orderType && !normalizedOrderType) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_order_type",
            };
        }
        if (normalizedPayload.stopLossTriggerMethod &&
            !this.normalizeStopLossTriggerMethod(normalizedPayload.stopLossTriggerMethod)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_stop_loss_trigger_method",
            };
        }
        if (executionMode === "AMEND_SLTP") {
            const hasNativeAmendValues = normalizedPayload.stopLoss !== undefined ||
                normalizedPayload.takeProfit !== undefined;
            const disablesTrailingTakeProfit = normalizedPayload.trailingTakeProfitActivationDistance === null &&
                normalizedPayload.trailingTakeProfitDistance === null;
            const disablesStopLossProtection = normalizedPayload.breakEvenActivationDistance === null &&
                normalizedPayload.breakEvenOffsetDistance === null &&
                normalizedPayload.trailingStopLossDistance === null;
            if (!hasNativeAmendValues &&
                !hasTrailingTakeProfit &&
                !hasStopLossProtection &&
                !disablesTrailingTakeProfit &&
                !disablesStopLossProtection) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "amend_sltp_requires_native_or_managed_protection_fields",
                };
            }
            if (normalizedPayload.stopLossDistance !== undefined ||
                normalizedPayload.takeProfitDistance !== undefined ||
                normalizedPayload.stopLossAmount !== undefined ||
                normalizedPayload.takeProfitAmount !== undefined) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "amend_sltp_rejects_distance_fields",
                };
            }
        }
        if (hasNativeStopLoss &&
            normalizedPayload.stopLoss !== undefined &&
            normalizedPayload.stopLoss !== null) {
            if (normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null ||
                normalizedPayload.stopLossAmount !== undefined && normalizedPayload.stopLossAmount !== null) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "stop_loss_input_types_conflict",
                };
            }
        }
        if (normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null) {
            if (normalizedPayload.stopLossAmount !== undefined && normalizedPayload.stopLossAmount !== null) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "stop_loss_input_types_conflict",
                };
            }
        }
        if (hasNativeTakeProfit &&
            normalizedPayload.takeProfit !== undefined &&
            normalizedPayload.takeProfit !== null) {
            if (normalizedPayload.takeProfitDistance !== undefined && normalizedPayload.takeProfitDistance !== null ||
                normalizedPayload.takeProfitAmount !== undefined && normalizedPayload.takeProfitAmount !== null) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "take_profit_input_types_conflict",
                };
            }
        }
        if (normalizedPayload.takeProfitDistance !== undefined &&
            normalizedPayload.takeProfitDistance !== null) {
            if (normalizedPayload.takeProfitAmount !== undefined && normalizedPayload.takeProfitAmount !== null) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "take_profit_input_types_conflict",
                };
            }
        }
        const normalizedStopLossDistance = this.normalizePositiveIntegerDistance(normalizedPayload.stopLossDistance, "stopLossDistance");
        const normalizedTakeProfitDistance = this.normalizePositiveIntegerDistance(normalizedPayload.takeProfitDistance, "takeProfitDistance");
        return {
            ...normalizedPayload,
            executionMode,
            entryRef,
            tradingStrength: normalizedTradingStrength,
            orderType: normalizedOrderType,
            stopLossDistance: normalizedStopLossDistance,
            takeProfitDistance: normalizedTakeProfitDistance,
            stopLossTriggerMethod: this.normalizeStopLossTriggerMethod(normalizedPayload.stopLossTriggerMethod) ?? null,
            breakEvenActivationDistance: normalizedBreakEvenActivationDistance,
            breakEvenOffsetDistance: normalizedBreakEvenOffsetDistance,
            trailingStopLossDistance: normalizedTrailingStopLossDistance,
        };
    }
    getExecutionBrokerCodes(payload) {
        const executionMode = this.normalizeExecutionMode(payload);
        if (!executionMode)
            return null;
        if (payload.market === trade_identify_1.MarketType.CRYPTO) {
            if (executionMode === "AMEND_SLTP") {
                // CoinDCX spot does not have proper position-style SL/TP amend flow.
                // Keep amend flow away from CoinDCX unless we explicitly implement it.
                return ["DELTA"];
            }
            // Crypto strategy OPEN signals should fan out to crypto brokers.
            // CoinDCX worker will pick COINDCX pending signals.
            // Delta worker will pick DELTA pending signals.
            return ["COINDCX", "DELTA"];
        }
        if (payload.market === trade_identify_1.MarketType.FOREX) {
            if (executionMode === "AMEND_SLTP")
                return ["CT"];
            return ["CT", "MT5"];
        }
        if (payload.market === trade_identify_1.MarketType.INDIAN) {
            if (executionMode === "AMEND_SLTP") {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "indian_amend_sltp_not_supported",
                };
            }
            return ["ZEBU"];
        }
        return null;
    }
    async queueEdgingCloseOppositeTrades(userTradingAccounts, payload, normalizedAction, queryRunner, assetType) {
        const uniqueUserIds = Array.from(new Set(userTradingAccounts.map((account) => Number(account.userId)).filter(Boolean)));
        const uniqueTradingAccountIds = Array.from(new Set(userTradingAccounts.map((account) => Number(account.id)).filter(Boolean)));
        if (!uniqueUserIds.length || !uniqueTradingAccountIds.length)
            return;
        const edgingRows = await Promise.all(uniqueUserIds.map(async (userId) => this.userDBService.getEdgingStatus(userId)));
        const edgingEnabledUserIds = new Set(edgingRows
            .filter((row) => row?.isEnabled)
            .map((row) => Number(row.userId))
            .filter(Boolean));
        const edgingAccountIds = userTradingAccounts
            .filter((account) => edgingEnabledUserIds.has(Number(account.userId)))
            .map((account) => Number(account.id))
            .filter(Boolean);
        if (!edgingAccountIds.length)
            return;
        const affected = await this.alertSnapshotDB.closeOppositeCompletedTrades({
            tradingAccountIds: edgingAccountIds,
            symbol: payload.ticker,
            exchange: payload.exchange,
            incomingAction: normalizedAction,
        }, queryRunner);
        if (affected > 0) {
            console.log("[ALERT] edging close-opposite queued", {
                affected,
                assetType,
                incomingAction: normalizedAction,
                symbol: payload.ticker,
                exchange: payload.exchange,
                accountCount: edgingAccountIds.length,
            });
        }
    }
    buildTradeSignals(userTradingAccounts, payload, snapshotId, normalizedAction, assetType, volume, context) {
        return userTradingAccounts.map((account) => ({
            userId: account.userId,
            tradingAccountId: account.id,
            alertSnapshotsId: snapshotId,
            adminStrategyTradeId: context?.adminStrategyTradeId ?? null,
            strategyId: context?.strategyId ?? null,
            planId: context?.planId ?? null,
            subscriptionId: context?.subscriptionId ?? null,
            action: normalizedAction,
            symbol: payload.ticker,
            price: payload.close,
            exchange: payload.exchange,
            signalTime: payload.alertTime,
            volume,
            assetType: assetType,
            executionMode: payload.executionMode ?? null,
            entryRef: payload.entryRef ?? null,
            orderType: payload.orderType ?? null,
            limitPrice: payload.limitPrice ?? null,
            stopPrice: payload.stopPrice ?? null,
            stopLoss: payload.stopLoss ?? null,
            takeProfit: payload.takeProfit ?? null,
            stopLossDistance: payload.stopLossDistance ?? null,
            takeProfitDistance: payload.takeProfitDistance ?? null,
            stopLossAmount: payload.stopLossAmount ?? null,
            takeProfitAmount: payload.takeProfitAmount ?? null,
            trailingStopLoss: payload.trailingStopLoss ?? null,
            guaranteedStopLoss: payload.guaranteedStopLoss ?? null,
            stopLossTriggerMethod: payload.stopLossTriggerMethod ?? null,
            trailingTakeProfitActivationDistance: payload.trailingTakeProfitActivationDistance ?? null,
            trailingTakeProfitDistance: payload.trailingTakeProfitDistance ?? null,
            breakEvenActivationDistance: payload.breakEvenActivationDistance ?? null,
            breakEvenOffsetDistance: payload.breakEvenOffsetDistance ?? null,
            trailingStopLossDistance: payload.trailingStopLossDistance ?? null,
            // Indian-market instrument classification (explicit)
            instrumentType: payload.instrumentType ?? null,
            product: payload.product ?? null,
            underlying: payload.underlying ?? null,
            expiry: payload.expiry ?? null,
            optionType: payload.optionType ?? null,
            strike: payload.strike ?? null,
            tradingSymbol: payload.tradingSymbol ?? null,
            sourceAction: payload.sourceAction ?? null,
            brokerInstrumentId: payload.brokerInstrumentId ?? null,
            instrumentToken: payload.instrumentToken ?? null,
            tickSize: payload.tickSize ?? null,
        }));
    }
    /**
     * Validate + normalize the explicit Indian instrument fields on an alert.
     * Defaults: EQUITY + DELIVERY when omitted (backward-compatible with old alerts).
     * Throws on inconsistent option/future payloads so bad alerts fail fast.
     */
    normalizeIndianInstrument(payload) {
        if (payload.market !== trade_identify_1.MarketType.INDIAN)
            return;
        const up = (v) => (v == null ? null : String(v).trim().toUpperCase());
        const instrumentType = up(payload.instrumentType) || "EQUITY";
        const rawProduct = up(payload.product) || "INTRADAY";
        const product = ["INTRADAY", "MIS", "I"].includes(rawProduct)
            ? "I"
            : ["MARGIN", "NRML", "M"].includes(rawProduct)
                ? "M"
                : ["DELIVERY", "CNC", "C"].includes(rawProduct)
                    ? "C"
                    : rawProduct;
        const optionType = up(payload.optionType);
        if (!["EQUITY", "FUTURES", "OPTIONS"].includes(instrumentType)) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_instrumentType" };
        }
        if (!["I", "C", "M"].includes(product)) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_product" };
        }
        if (instrumentType === "OPTIONS") {
            const hasExplicit = Boolean(payload.tradingSymbol);
            if (!hasExplicit) {
                if (!["CE", "PE"].includes(optionType ?? "")) {
                    throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "option_requires_optionType_CE_PE" };
                }
                if (payload.strike == null || !Number.isFinite(Number(payload.strike))) {
                    throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "option_requires_strike" };
                }
                if (!payload.underlying || !payload.expiry) {
                    throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "option_requires_underlying_and_expiry" };
                }
            }
        }
        if (instrumentType === "FUTURES" && !payload.tradingSymbol) {
            if (!payload.underlying || !payload.expiry) {
                throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "future_requires_underlying_and_expiry" };
            }
        }
        payload.instrumentType = instrumentType;
        payload.product = product;
        payload.optionType = optionType ?? null;
        payload.underlying = payload.underlying ? String(payload.underlying).trim().toUpperCase() : null;
        payload.expiry = payload.expiry ?? null;
        payload.strike = payload.strike != null ? Number(payload.strike) : null;
        payload.tradingSymbol = payload.tradingSymbol ? String(payload.tradingSymbol).trim().toUpperCase() : null;
    }
    async getBrokerIdsForPayload(payload) {
        const brokerCodes = this.getExecutionBrokerCodes(payload);
        if (brokerCodes) {
            return this.alertSnapshotDB.getBrokerIdByCodes(payload.market, brokerCodes);
        }
        return this.alertSnapshotDB.getBrokerId(payload.market);
    }
    logStrategyExecutionResolution(args) {
        const { subscriptionId, userId, brokerIds, eligibleOwnedAccountIds, masterAccountIds, followerAccountIds, resolvedAccountIds, } = args;
        if (!resolvedAccountIds.length) {
            console.log("[ALERT] strategy_exec_skipped_no_eligible_accounts", {
                subscriptionId,
                userId,
                brokerIds,
                eligibleOwnedAccountIds,
                masterAccountIds,
                followerAccountIds,
                reason: "no_verified_enabled_strategy_accounts",
            });
            return;
        }
        if (masterAccountIds.length > 0) {
            console.log("[ALERT] strategy_exec_master_with_followers_used", {
                subscriptionId,
                userId,
                brokerIds,
                eligibleOwnedAccountIds,
                masterAccountIds,
                followerAccountIds,
                resolvedAccountIds,
            });
            return;
        }
        console.log("[ALERT] strategy_exec_non_master_account_used", {
            subscriptionId,
            userId,
            brokerIds,
            eligibleOwnedAccountIds,
            masterAccountIds,
            followerAccountIds,
            resolvedAccountIds,
        });
    }
    async buildStrategySignalBatch(subscription, payload, normalizedAction, assetType, strategyInstance, queryRunner, brokerIds, options) {
        const strategyPlanId = subscription.planId ?? strategyInstance.planId ?? null;
        const strategyContext = {
            adminStrategyTradeId: options?.adminStrategyTradeId ?? null,
            strategyId: Number(strategyInstance.strategyId),
            planId: strategyPlanId === null ? null : Number(strategyPlanId),
            subscriptionId: Number(subscription.id),
        };
        const snapshot = await this.alertSnapshotDB.create({
            ...payload,
            userId: Number(subscription.userId),
            ...strategyContext,
        }, queryRunner);
        if (options?.executeActions === false) {
            return {
                snapshotId: snapshot.id,
                recipientCount: 0,
                signalCount: 0,
                snapshotCount: 1,
            };
        }
        // Strategy execution currently resolves against verified, enabled accounts
        // tied to the subscriber's subscription. `user_strategy_instances.tradingAccountId`
        // exists in schema, but is legacy/null in current data and is not the source of truth.
        const strategyExecution = await this.tradingAccountService.resolveStrategyExecutionTargets(Number(subscription.userId), Number(subscription.id), brokerIds);
        const userTradingAccounts = strategyExecution.accounts;
        this.logStrategyExecutionResolution({
            subscriptionId: Number(subscription.id),
            userId: Number(subscription.userId),
            brokerIds,
            eligibleOwnedAccountIds: strategyExecution.eligibleOwnedAccountIds,
            masterAccountIds: strategyExecution.masterAccountIds,
            followerAccountIds: strategyExecution.followerAccountIds,
            resolvedAccountIds: userTradingAccounts.map((account) => Number(account.id)),
        });
        const shouldQueueCloseOpposite = normalizedAction !== "HOLD" &&
            userTradingAccounts.length > 0 &&
            (assetType === trade_identify_1.AssetType.FOREX ||
                assetType === trade_identify_1.AssetType.CRYPTO ||
                (payload.market === trade_identify_1.MarketType.INDIAN && this.normalizeExecutionMode(payload) === "OPEN"));
        if (shouldQueueCloseOpposite) {
            const directionAction = String(payload.sourceAction ?? "").toUpperCase() === "SELL"
                ? "SELL"
                : String(payload.sourceAction ?? "").toUpperCase() === "BUY"
                    ? "BUY"
                    : normalizedAction;
            await this.queueEdgingCloseOppositeTrades(userTradingAccounts, {
                ...payload,
                userId: Number(subscription.userId),
            }, directionAction, queryRunner, assetType);
        }
        const tradeSignalPayload = userTradingAccounts.length > 0
            ? this.buildTradeSignals(userTradingAccounts, payload, snapshot.id, normalizedAction, assetType, payload.brokerInstrumentId
                ? Number(payload.volume)
                : Number(strategyInstance.volume), strategyContext)
            : [];
        if (tradeSignalPayload.length > 0) {
            await this.tradeSignalService.createTradeSignal(tradeSignalPayload, queryRunner);
        }
        return {
            snapshotId: snapshot.id,
            recipientCount: userTradingAccounts.length > 0 ? 1 : 0,
            signalCount: tradeSignalPayload.length,
            snapshotCount: 1,
        };
    }
    async create(payload) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let normalizedPayload = this.validateAndNormalizeExecutionFields(this.normalizeSimplifiedLuxAlert(payload));
            this.normalizeIndianInstrument(normalizedPayload);
            let executionMode = this.normalizeExecutionMode(normalizedPayload);
            let assetType = await this.isValidAssetType(normalizedPayload);
            let normalizedAction = this.normalizeAction(String(normalizedPayload.action ?? "")) ??
                (executionMode === "AMEND_SLTP" ? "HOLD" : null);
            if (!normalizedAction) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_action",
                };
            }
            const tokenSubscription = normalizedPayload.tokenType === "webhook" && normalizedPayload.subscriptionId
                ? await this.userSubscriptionDbService.getActiveSubscriptionById(Number(normalizedPayload.userId), Number(normalizedPayload.subscriptionId))
                : null;
            let isValidPlan = tokenSubscription;
            if (!isValidPlan) {
                isValidPlan =
                    await this.userSubscriptionService.subscriberPlanValidation(normalizedPayload.userId, normalizedPayload.market);
            }
            if (!isValidPlan) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_subscription_plan",
                };
            }
            const matchedPlan = isValidPlan?.plan ?? null;
            if (tokenSubscription?.plan?.market?.code &&
                tokenSubscription.plan.market.code !== normalizedPayload.market) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_subscription_plan",
                };
            }
            const firstPlanStrategy = (0, planStrategy_1.selectPrimaryPlanStrategy)(matchedPlan?.planStrategies);
            if (firstPlanStrategy && normalizedPayload.tokenType === "webhook" && tokenSubscription) {
                const strategyInstances = await this.userSubscriptionDbService.getStrategyInstancesBySubscriptionIds([
                    Number(tokenSubscription.id),
                ]);
                const strategyInstance = strategyInstances.find((instance) => Number(instance.subscriptionId) === Number(tokenSubscription.id) &&
                    instance.status === subscriberPlan_enum_1.UserStrategyStatus.ACTIVE &&
                    Number(instance.strategyId) === Number(firstPlanStrategy.strategyId));
                if (!strategyInstance) {
                    throw {
                        statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                        message: "strategy_instance_not_active",
                    };
                }
                const optionConfig = this.optionResolver.resolveConfig(firstPlanStrategy?.strategy?.defaultParams, strategyInstance?.frozenParams);
                normalizedPayload = await this.optionResolver.resolve(normalizedPayload, optionConfig);
                this.normalizeIndianInstrument(normalizedPayload);
                executionMode = this.normalizeExecutionMode(normalizedPayload);
                assetType = await this.isValidAssetType(normalizedPayload);
                normalizedAction =
                    this.normalizeAction(String(normalizedPayload.action ?? "")) ??
                        (executionMode === "AMEND_SLTP" ? "HOLD" : null);
                if (!normalizedAction) {
                    throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_action" };
                }
                const brokerData = await this.getBrokerIdsForPayload(normalizedPayload);
                const strategyResult = await this.buildStrategySignalBatch(tokenSubscription, normalizedPayload, normalizedAction, assetType, strategyInstance, queryRunner, brokerData);
                await queryRunner.commitTransaction();
                return {
                    snapshotId: Number(strategyResult.snapshotId),
                    signalCount: strategyResult.signalCount,
                    recipientCount: strategyResult.recipientCount,
                };
            }
            if (firstPlanStrategy) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "strategy_managed_plan_requires_admin_webhook",
                };
            }
            let snapshot = await this.alertSnapshotDB.create(normalizedPayload, queryRunner);
            let brokerData = await this.getBrokerIdsForPayload(normalizedPayload);
            let userTradingAccounts = await this.tradingAccountService.getAllCopyTradingAccounts(normalizedPayload.userId, brokerData);
            const shouldQueueCloseOpposite = normalizedAction !== "HOLD" &&
                userTradingAccounts.length > 0 &&
                (assetType === trade_identify_1.AssetType.FOREX ||
                    assetType === trade_identify_1.AssetType.CRYPTO ||
                    (normalizedPayload.market === trade_identify_1.MarketType.INDIAN && executionMode === "OPEN"));
            if (shouldQueueCloseOpposite) {
                const directionAction = String(normalizedPayload.sourceAction ?? "").toUpperCase() === "SELL"
                    ? "SELL"
                    : String(normalizedPayload.sourceAction ?? "").toUpperCase() === "BUY"
                        ? "BUY"
                        : normalizedAction;
                await this.queueEdgingCloseOppositeTrades(userTradingAccounts, normalizedPayload, directionAction, queryRunner, assetType);
            }
            let tradeSignalPayload = [];
            if (userTradingAccounts.length > 0) {
                console.log("Creating trade signals for user", userTradingAccounts);
                tradeSignalPayload = this.buildTradeSignals(userTradingAccounts, normalizedPayload, snapshot.id, normalizedAction, assetType, normalizedPayload.volume);
            }
            if (tradeSignalPayload.length > 0) {
                await this.tradeSignalService.createTradeSignal(tradeSignalPayload, queryRunner);
            }
            await queryRunner.commitTransaction();
            return {
                snapshotId: Number(snapshot.id),
                signalCount: tradeSignalPayload.length,
                recipientCount: userTradingAccounts.length > 0 ? 1 : 0,
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async createForPlan(planId, payload) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let normalizedPayload = this.validateAndNormalizeExecutionFields(this.normalizeSimplifiedLuxAlert(payload));
            this.normalizeIndianInstrument(normalizedPayload);
            let executionMode = this.normalizeExecutionMode(normalizedPayload);
            let assetType = await this.isValidAssetType(normalizedPayload);
            let normalizedAction = this.normalizeAction(String(normalizedPayload.action ?? "")) ??
                (executionMode === "AMEND_SLTP" ? "HOLD" : null);
            if (!normalizedAction) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_action",
                };
            }
            const plan = await this.subscriptionPlanService.getPlan(planId);
            if (!plan?.isActive) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "inactive_plan",
                };
            }
            if (plan.market?.code && plan.market.code !== normalizedPayload.market) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "plan_market_mismatch",
                };
            }
            const primaryPlanStrategy = (0, planStrategy_1.selectPrimaryPlanStrategy)(plan.planStrategies);
            const strategy = primaryPlanStrategy?.strategy ?? plan.strategy ?? null;
            if (!strategy) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "plan_has_no_strategy",
                };
            }
            const subscriptions = await this.userSubscriptionDbService.getActiveStrategySubscriptionsForPlan(planId);
            const strategyInstances = await this.userSubscriptionDbService.getStrategyInstancesBySubscriptionIds(subscriptions.map((subscription) => Number(subscription.id)));
            const strategyInstanceMap = new Map(strategyInstances.map((instance) => [Number(instance.subscriptionId), instance]));
            const tradingStrengthAllowsExecution = normalizedPayload.tradingStrength !== null &&
                normalizedPayload.tradingStrength !== undefined &&
                Number(normalizedPayload.tradingStrength) > 40;
            let scheduleBlocked = false;
            let scheduleWindowIds = [];
            if (tradingStrengthAllowsExecution &&
                typeof this.userDBService?.getAdminStrategyTradeSchedule ===
                    "function") {
                try {
                    const schedule = await this.userDBService.getAdminStrategyTradeSchedule();
                    const evaluation = (0, adminStrategyTradeSchedule_util_1.evaluateAdminStrategyTradeSchedule)(schedule, new Date(Date.now()));
                    scheduleBlocked = evaluation.isBlocked;
                    scheduleWindowIds = evaluation.matchingWindowIds;
                }
                catch (error) {
                    console.warn("[ALERT] failed to evaluate admin strategy trade schedule; continuing without schedule gate", {
                        planId,
                        ticker: normalizedPayload.ticker,
                        error: error instanceof Error ? error.message : error,
                    });
                }
            }
            const shouldExecuteActions = tradingStrengthAllowsExecution && !scheduleBlocked;
            if (shouldExecuteActions) {
                const optionConfig = this.optionResolver.resolveConfig(strategy.defaultParams);
                normalizedPayload = await this.optionResolver.resolve(normalizedPayload, optionConfig);
                this.normalizeIndianInstrument(normalizedPayload);
                executionMode = this.normalizeExecutionMode(normalizedPayload);
                assetType = await this.isValidAssetType(normalizedPayload);
                normalizedAction =
                    this.normalizeAction(String(normalizedPayload.action ?? "")) ??
                        (executionMode === "AMEND_SLTP" ? "HOLD" : null);
                if (!normalizedAction) {
                    throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_action" };
                }
            }
            console.log("[ALERT] strategy tradingStrength gate", {
                planId,
                strategyId: Number(strategy.id),
                ticker: normalizedPayload.ticker,
                action: normalizedAction,
                executionMode,
                entryRef: normalizedPayload.entryRef ?? null,
                tradingStrength: normalizedPayload.tradingStrength ?? null,
                tradingStrengthAllowsExecution,
                scheduleBlocked,
                scheduleWindowIds,
                shouldExecuteActions,
                subscriptionCount: subscriptions.length,
            });
            const adminStrategyTrade = await this.alertSnapshotDB.createAdminStrategyTrade({
                planId,
                strategyId: Number(strategy.id),
                source: "plan_webhook",
                action: normalizedPayload.sourceAction ?? normalizedAction,
                symbol: normalizedPayload.ticker,
                exchange: normalizedPayload.exchange ?? null,
                price: normalizedPayload.close ?? null,
                executionMode,
                entryRef: normalizedPayload.entryRef ?? null,
                orderType: normalizedPayload.orderType ?? null,
                limitPrice: normalizedPayload.limitPrice ?? null,
                stopPrice: normalizedPayload.stopPrice ?? null,
                stopLoss: normalizedPayload.stopLoss ?? null,
                takeProfit: normalizedPayload.takeProfit ?? null,
                stopLossDistance: normalizedPayload.stopLossDistance ?? null,
                takeProfitDistance: normalizedPayload.takeProfitDistance ?? null,
                stopLossAmount: normalizedPayload.stopLossAmount ?? null,
                takeProfitAmount: normalizedPayload.takeProfitAmount ?? null,
                trailingStopLoss: normalizedPayload.trailingStopLoss ?? null,
                guaranteedStopLoss: normalizedPayload.guaranteedStopLoss ?? null,
                stopLossTriggerMethod: normalizedPayload.stopLossTriggerMethod ?? null,
                trailingTakeProfitActivationDistance: normalizedPayload.trailingTakeProfitActivationDistance ?? null,
                trailingTakeProfitDistance: normalizedPayload.trailingTakeProfitDistance ?? null,
                breakEvenActivationDistance: normalizedPayload.breakEvenActivationDistance ?? null,
                breakEvenOffsetDistance: normalizedPayload.breakEvenOffsetDistance ?? null,
                trailingStopLossDistance: normalizedPayload.trailingStopLossDistance ?? null,
                tradingStrength: normalizedPayload.tradingStrength ?? null,
                rawPayload: normalizedPayload,
                executionAllowed: shouldExecuteActions,
                scheduleBlocked,
                scheduleWindowIds,
            }, queryRunner);
            const brokerData = shouldExecuteActions
                ? await this.getBrokerIdsForPayload(normalizedPayload)
                : [];
            let recipientCount = 0;
            let signalCount = 0;
            let snapshotCount = 0;
            for (const subscription of subscriptions) {
                if (subscription.user?.isAdmin === true)
                    continue;
                const instance = strategyInstanceMap.get(Number(subscription.id));
                if (!instance)
                    continue;
                if (instance.status !== subscriberPlan_enum_1.UserStrategyStatus.ACTIVE)
                    continue;
                if (Number(instance.strategyId) !== Number(strategy.id))
                    continue;
                const result = await this.buildStrategySignalBatch(subscription, {
                    ...normalizedPayload,
                    userId: Number(subscription.userId),
                }, normalizedAction, assetType, instance, queryRunner, brokerData, {
                    executeActions: shouldExecuteActions,
                    adminStrategyTradeId: Number(adminStrategyTrade.id),
                });
                snapshotCount += result.snapshotCount;
                recipientCount += result.recipientCount;
                signalCount += result.signalCount;
            }
            const adminTradeStatus = !shouldExecuteActions
                ? "blocked"
                : signalCount > 0
                    ? "fanned_out"
                    : "no_signals";
            await this.alertSnapshotDB.updateAdminStrategyTradeFanout(Number(adminStrategyTrade.id), {
                recipientCount,
                snapshotCount,
                signalCount,
                status: adminTradeStatus,
            }, queryRunner);
            await queryRunner.commitTransaction();
            return {
                adminStrategyTradeId: Number(adminStrategyTrade.id),
                planId,
                strategyId: Number(strategy.id),
                recipientCount,
                snapshotCount,
                signalCount,
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async isValidAssetType(payload) {
        try {
            const explained = trade_identify_1.AssetClassifier.explain({
                symbol: payload.ticker,
                exchange: payload.exchange,
                market: payload.market,
            });
            let assetType = explained.assetType;
            if (assetType === trade_identify_1.AssetType.UNKNOWN) {
                console.warn("[ALERT] unsupported_asset_type payload", {
                    ticker: payload.ticker,
                    exchange: payload.exchange,
                    market: payload.market,
                    classifier: explained,
                });
                throw {
                    status: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "unsupported_asset_type",
                };
            }
            return assetType;
        }
        catch (error) {
            throw error;
        }
    }
    async getAlertHistory(userId, query) {
        try {
            const data = await this.alertSnapshotDB.getAlertHistory(userId, query);
            return data;
        }
        catch (error) {
            throw error;
        }
    }
    async getAdminAlertHistory(query) {
        return this.alertSnapshotDB.getAdminAlertHistory(query);
    }
}
exports.AlertSnapshotService = AlertSnapshotService;
