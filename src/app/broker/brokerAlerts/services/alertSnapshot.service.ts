import AppDataSource from "../../../../db/data-source";
import { HttpStatusCode } from "../../../../types/constants";
import { AssetClassifier, AssetType, MarketType } from "../../../../types/trade-identify";
// import { CopyTradingService } from "../../../copyTrading/services/copyTrading.service";
// import { CTraderService } from "../../../cTraderListener/services/cTrader";
import { UserSubscriptionService } from "../../../userSubscription/services/userSubscription";
import { UserSubscriptionDBService } from "../../../userSubscription/services/userSubscription.db";
import { TradeSignalService } from "../../brokerSignals/services/tradeSignal.service";
import { AlertSnapshotDB } from "./alertSnapshot.db";
import {
  AdminHistoryQuery,
  HistoryQuery,
  ICreateAlertSnapshot,
  ICreateStrategyManagedAlert,
  StopLossTriggerMethod,
  StrategyExecutionFields,
  StrategyOrderType,
  TradeExecutionMode,
} from "../interfaces/alertSnapshot.interface";
import { AlertSnapshot } from "../../../../entity/AlertSnapshots";
import { TradingAccountService } from "../../../tradingAccount/services/tradingAccount.service";
import { ICreateTradeSignal } from "../../brokerSignals/interfaces/tradeSignal.interface";
import { UserDBService } from "../../../user/services/user.db";
import { QueryRunner } from "typeorm";
import { SubscriptionPlanService } from "../../../subscriptionPlan/services/subscriptionPlan";
import { UserStrategyStatus } from "../../../subscriptionPlan/enums/subscriberPlan.enum";
import { selectPrimaryPlanStrategy } from "../../../subscriptionPlan/utils/planStrategy";
import { DistanceMappingService } from "../../../trade/services/distanceMapping.service";
import { evaluateAdminStrategyTradeSchedule } from "../../../user/utils/adminStrategyTradeSchedule.util";
import { AdminStrategyTradeStatus } from "../../../../entity/AdminStrategyTrade";

export class AlertSnapshotService {
  private alertSnapshotDB: AlertSnapshotDB;
  private tradeSignalService: TradeSignalService;
  // private cTraderService: CTraderService;
  private userSubscriptionService: UserSubscriptionService;
  private userSubscriptionDbService: UserSubscriptionDBService;
  // private copyTradingService: CopyTradingService;
  private tradingAccountService: TradingAccountService;
  private userDBService: UserDBService;
  private subscriptionPlanService: SubscriptionPlanService;
  private distanceMappingService: DistanceMappingService;
  constructor() {
    this.alertSnapshotDB = new AlertSnapshotDB();
    this.tradeSignalService = new TradeSignalService();
    this.userSubscriptionService = new UserSubscriptionService();
    this.userSubscriptionDbService = new UserSubscriptionDBService();
    // this.copyTradingService = new CopyTradingService();
    // this.cTraderService = new CTraderService();
    this.tradingAccountService = new TradingAccountService();
    this.userDBService = new UserDBService();
    this.subscriptionPlanService = new SubscriptionPlanService();
    this.distanceMappingService = new DistanceMappingService();
  }

  private normalizeAction(action: string): "BUY" | "SELL" | null {
    const normalized = String(action ?? "").trim().toUpperCase();
    if (normalized === "BUY") return "BUY";
    if (normalized === "SELL") return "SELL";
    return null;
  }

  private normalizeTradingStrength(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "invalid_trading_strength",
        };
      }
      return value;
    }

    const normalized = String(value).trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_trading_strength",
      };
    }
    return parsed;
  }

  private hasManagedTrailingTakeProfit(payload: Partial<StrategyExecutionFields>) {
    return (
      payload.trailingTakeProfitActivationDistance !== undefined &&
      payload.trailingTakeProfitActivationDistance !== null
    ) || (
      payload.trailingTakeProfitDistance !== undefined &&
      payload.trailingTakeProfitDistance !== null
    );
  }

  private hasManagedStopLossProtection(payload: Partial<StrategyExecutionFields>) {
    return (
      payload.breakEvenActivationDistance !== undefined &&
      payload.breakEvenActivationDistance !== null
    ) || (
      payload.breakEvenOffsetDistance !== undefined &&
      payload.breakEvenOffsetDistance !== null
    ) || (
      payload.trailingStopLossDistance !== undefined &&
      payload.trailingStopLossDistance !== null
    );
  }

  private isIndianOpenExecution(payload: Partial<ICreateAlertSnapshot>) {
    return payload.market === MarketType.INDIAN && this.normalizeExecutionMode(payload) === "OPEN";
  }

  private rejectUnsupportedIndianProtectionFields(payload: Partial<ICreateAlertSnapshot>) {
    if (!this.isIndianOpenExecution(payload)) return;

    const orderType = this.normalizeOrderType(payload.orderType);
    if (orderType === "MARKET_RANGE") {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "zebu_unsupported_order_type",
      };
    }

    if (payload.stopLossAmount !== undefined && payload.stopLossAmount !== null) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "zebu_rejects_stop_loss_amount",
      };
    }

    if (payload.takeProfitAmount !== undefined && payload.takeProfitAmount !== null) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "zebu_rejects_take_profit_amount",
      };
    }

    if (this.hasManagedTrailingTakeProfit(payload)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "zebu_rejects_trailing_take_profit",
      };
    }
  }

  private hasExtendedExecutionFields(payload: Partial<StrategyExecutionFields>) {
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

  private normalizeExecutionMode(payload: Partial<StrategyExecutionFields>): TradeExecutionMode | null {
    const raw = String(payload.executionMode ?? "").trim().toUpperCase();
    if (raw === "OPEN" || raw === "AMEND_SLTP") return raw as TradeExecutionMode;
    return this.hasExtendedExecutionFields(payload) ? "OPEN" : null;
  }

  private normalizeOrderType(orderType: unknown): StrategyOrderType | null {
    const normalized = String(orderType ?? "").trim().toUpperCase();
    if (
      normalized === "MARKET" ||
      normalized === "LIMIT" ||
      normalized === "STOP" ||
      normalized === "STOP_LIMIT" ||
      normalized === "MARKET_RANGE"
    ) {
      return normalized as StrategyOrderType;
    }
    return null;
  }

  private normalizeStopLossTriggerMethod(value: unknown): StopLossTriggerMethod | null {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (
      normalized === "TRADE" ||
      normalized === "OPPOSITE" ||
      normalized === "DOUBLE_TRADE" ||
      normalized === "DOUBLE_OPPOSITE"
    ) {
      return normalized as StopLossTriggerMethod;
    }
    return null;
  }

  private normalizePositiveIntegerDistance(
    value: unknown,
    field: "stopLossDistance" | "takeProfitDistance",
  ): number | null {
    if (value === undefined || value === null || value === "") return null;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: `invalid_${field}`,
      };
    }

    return parsed;
  }

  private normalizeRuleDistance(
    value: unknown,
    field:
      | "breakEvenActivationDistance"
      | "breakEvenOffsetDistance"
      | "trailingStopLossDistance",
    options?: { allowZero?: boolean },
  ): number | null {
    if (value === undefined || value === null || value === "") return null;

    const parsed = Number(value);
    const allowZero = options?.allowZero === true;
    const valid = Number.isFinite(parsed) && Number.isInteger(parsed) && (allowZero ? parsed >= 0 : parsed > 0);
    if (!valid) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: `invalid_${field}`,
      };
    }

    return parsed;
  }

  private tryNormalizeLegacyAmountAsDistance(symbol: unknown, value: unknown): number | null {
    if (value === undefined || value === null || value === "") return null;

    try {
      return this.distanceMappingService.resolve({
        broker: "CTRADER",
        symbol: String(symbol ?? ""),
        requestedDistance: value as number | string,
      }).requestedDistance;
    } catch {
      return null;
    }
  }

  private normalizeLegacyLogicalDistanceAliases<T extends Partial<ICreateAlertSnapshot>>(payload: T): T {
    const normalizedPayload = { ...payload } as T & {
      stopLossDistance?: number | null;
      takeProfitDistance?: number | null;
      stopLossAmount?: number | null;
      takeProfitAmount?: number | null;
    };

    const normalizedStopLossDistance =
      normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null
        ? null
        : this.tryNormalizeLegacyAmountAsDistance(
            normalizedPayload.ticker,
            normalizedPayload.stopLossAmount,
          );
    const normalizedTakeProfitDistance =
      normalizedPayload.takeProfitDistance !== undefined && normalizedPayload.takeProfitDistance !== null
        ? null
        : this.tryNormalizeLegacyAmountAsDistance(
            normalizedPayload.ticker,
            normalizedPayload.takeProfitAmount,
          );

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

  private normalizeManagedProtectionAliases<T extends Partial<ICreateAlertSnapshot>>(payload: T): T {
    const normalizedPayload = { ...payload } as T & Record<string, unknown>;
    if (normalizedPayload.breakEvenActivationDistance === undefined) {
      normalizedPayload.breakEvenActivationDistance =
        normalizedPayload.breakEvenAfterPips ??
        normalizedPayload.moveStopLossToBreakEvenAfterPips as any;
    }
    if (normalizedPayload.breakEvenOffsetDistance === undefined) {
      normalizedPayload.breakEvenOffsetDistance = normalizedPayload.breakEvenOffsetPips as any;
    }
    if (normalizedPayload.trailingStopLossDistance === undefined) {
      normalizedPayload.trailingStopLossDistance = normalizedPayload.trailingStopDistancePips as any;
    }
    return normalizedPayload as T;
  }

  private validateAndNormalizeExecutionFields<T extends Partial<ICreateAlertSnapshot>>(
    payload: T
  ): T {
    this.rejectUnsupportedIndianProtectionFields(payload);
    const legacyNormalizedPayload =
      payload.market === MarketType.INDIAN ? payload : this.normalizeLegacyLogicalDistanceAliases(payload);
    const normalizedPayload = this.normalizeManagedProtectionAliases(legacyNormalizedPayload);
    const executionMode = this.normalizeExecutionMode(normalizedPayload);
    const normalizedTradingStrength = this.normalizeTradingStrength(
      (normalizedPayload as ICreateAlertSnapshot).tradingStrength
    );
    const hasTrailingTakeProfit = this.hasManagedTrailingTakeProfit(normalizedPayload);
    const hasStopLossProtection = this.hasManagedStopLossProtection(normalizedPayload);
    const hasNativeStopLoss =
      normalizedPayload.stopLoss !== undefined && normalizedPayload.stopLoss !== null ||
      normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null ||
      normalizedPayload.stopLossAmount !== undefined && normalizedPayload.stopLossAmount !== null;
    const hasNativeTakeProfit =
      normalizedPayload.takeProfit !== undefined && normalizedPayload.takeProfit !== null ||
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
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "entry_ref_required",
      };
    }
    if (entryRef.length > 100) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "entry_ref_too_long",
      };
    }

    if (hasNativeTakeProfit && hasTrailingTakeProfit) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "native_take_profit_conflicts_with_trailing_take_profit",
      };
    }

    if (hasTrailingTakeProfit) {
      const activation = normalizedPayload.trailingTakeProfitActivationDistance;
      const distance = normalizedPayload.trailingTakeProfitDistance;
      if (
        activation === undefined ||
        activation === null ||
        distance === undefined ||
        distance === null
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "trailing_take_profit_fields_must_be_provided_together",
        };
      }
    }

    let normalizedBreakEvenActivationDistance: number | null = null;
    let normalizedBreakEvenOffsetDistance: number | null = null;
    let normalizedTrailingStopLossDistance: number | null = null;

    if (hasStopLossProtection) {
      if (normalizedPayload.trailingStopLoss === true) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "native_trailing_stop_loss_conflicts_with_managed_stop_loss_protection",
        };
      }

      normalizedBreakEvenActivationDistance = this.normalizeRuleDistance(
        normalizedPayload.breakEvenActivationDistance,
        "breakEvenActivationDistance",
      );
      if (normalizedBreakEvenActivationDistance === null) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "break_even_activation_distance_required",
        };
      }
      normalizedBreakEvenOffsetDistance = this.normalizeRuleDistance(
        normalizedPayload.breakEvenOffsetDistance ?? 0,
        "breakEvenOffsetDistance",
        { allowZero: true },
      );
      normalizedTrailingStopLossDistance = this.normalizeRuleDistance(
        normalizedPayload.trailingStopLossDistance,
        "trailingStopLossDistance",
      );
    }

    const normalizedOrderType =
      this.normalizeOrderType(normalizedPayload.orderType) ?? (executionMode === "OPEN" ? "MARKET" : null);
    if (normalizedPayload.orderType && !normalizedOrderType) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_order_type",
      };
    }

    if (
      normalizedPayload.stopLossTriggerMethod &&
      !this.normalizeStopLossTriggerMethod(normalizedPayload.stopLossTriggerMethod)
    ) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_stop_loss_trigger_method",
      };
    }

    if (executionMode === "AMEND_SLTP") {
      const hasNativeAmendValues =
        normalizedPayload.stopLoss !== undefined ||
        normalizedPayload.takeProfit !== undefined;
      const disablesTrailingTakeProfit =
        normalizedPayload.trailingTakeProfitActivationDistance === null &&
        normalizedPayload.trailingTakeProfitDistance === null;
      const disablesStopLossProtection =
        normalizedPayload.breakEvenActivationDistance === null &&
        normalizedPayload.breakEvenOffsetDistance === null &&
        normalizedPayload.trailingStopLossDistance === null;

      if (
        !hasNativeAmendValues &&
        !hasTrailingTakeProfit &&
        !hasStopLossProtection &&
        !disablesTrailingTakeProfit &&
        !disablesStopLossProtection
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "amend_sltp_requires_native_or_managed_protection_fields",
        };
      }

      if (
        normalizedPayload.stopLossDistance !== undefined ||
        normalizedPayload.takeProfitDistance !== undefined ||
        normalizedPayload.stopLossAmount !== undefined ||
        normalizedPayload.takeProfitAmount !== undefined
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "amend_sltp_rejects_distance_fields",
        };
      }
    }

    if (
      hasNativeStopLoss &&
      normalizedPayload.stopLoss !== undefined &&
      normalizedPayload.stopLoss !== null
    ) {
      if (
        normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null ||
        normalizedPayload.stopLossAmount !== undefined && normalizedPayload.stopLossAmount !== null
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "stop_loss_input_types_conflict",
        };
      }
    }

    if (normalizedPayload.stopLossDistance !== undefined && normalizedPayload.stopLossDistance !== null) {
      if (normalizedPayload.stopLossAmount !== undefined && normalizedPayload.stopLossAmount !== null) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "stop_loss_input_types_conflict",
        };
      }
    }

    if (
      hasNativeTakeProfit &&
      normalizedPayload.takeProfit !== undefined &&
      normalizedPayload.takeProfit !== null
    ) {
      if (
        normalizedPayload.takeProfitDistance !== undefined && normalizedPayload.takeProfitDistance !== null ||
        normalizedPayload.takeProfitAmount !== undefined && normalizedPayload.takeProfitAmount !== null
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "take_profit_input_types_conflict",
        };
      }
    }

    if (
      normalizedPayload.takeProfitDistance !== undefined &&
      normalizedPayload.takeProfitDistance !== null
    ) {
      if (normalizedPayload.takeProfitAmount !== undefined && normalizedPayload.takeProfitAmount !== null) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "take_profit_input_types_conflict",
        };
      }
    }

    const normalizedStopLossDistance = this.normalizePositiveIntegerDistance(
      normalizedPayload.stopLossDistance,
      "stopLossDistance",
    );
    const normalizedTakeProfitDistance = this.normalizePositiveIntegerDistance(
      normalizedPayload.takeProfitDistance,
      "takeProfitDistance",
    );

    return {
      ...normalizedPayload,
      executionMode,
      entryRef,
      tradingStrength: normalizedTradingStrength,
      orderType: normalizedOrderType,
      stopLossDistance: normalizedStopLossDistance,
      takeProfitDistance: normalizedTakeProfitDistance,
      stopLossTriggerMethod:
        this.normalizeStopLossTriggerMethod(normalizedPayload.stopLossTriggerMethod) ?? null,
      breakEvenActivationDistance: normalizedBreakEvenActivationDistance,
      breakEvenOffsetDistance: normalizedBreakEvenOffsetDistance,
      trailingStopLossDistance: normalizedTrailingStopLossDistance,
    };
  }

  private getExecutionBrokerCodes(payload: Partial<ICreateAlertSnapshot>) {
    const executionMode = this.normalizeExecutionMode(payload);
    if (!executionMode) return null;
    if (executionMode === "AMEND_SLTP") return ["CT"];
    if (payload.market === MarketType.INDIAN) return ["ZEBU"];
    return ["CT", "MT5"];
  }

  private async queueEdgingCloseOppositeTrades(
    userTradingAccounts: { userId: number; id: number }[],
    payload: ICreateAlertSnapshot,
    normalizedAction: "BUY" | "SELL",
    queryRunner: QueryRunner,
    assetType: AssetType,
  ) {
    const uniqueUserIds = Array.from(
      new Set(userTradingAccounts.map((account) => Number(account.userId)).filter(Boolean)),
    );
    const uniqueTradingAccountIds = Array.from(
      new Set(userTradingAccounts.map((account) => Number(account.id)).filter(Boolean)),
    );

    if (!uniqueUserIds.length || !uniqueTradingAccountIds.length) return;

    const edgingRows = await Promise.all(
      uniqueUserIds.map(async (userId) => this.userDBService.getEdgingStatus(userId)),
    );
    const edgingEnabledUserIds = new Set(
      edgingRows
        .filter((row) => row?.isEnabled)
        .map((row) => Number(row.userId))
        .filter(Boolean),
    );

    const edgingAccountIds = userTradingAccounts
      .filter((account) => edgingEnabledUserIds.has(Number(account.userId)))
      .map((account) => Number(account.id))
      .filter(Boolean);

    if (!edgingAccountIds.length) return;

    const affected = await this.alertSnapshotDB.closeOppositeCompletedTrades(
      {
        tradingAccountIds: edgingAccountIds,
        symbol: payload.ticker,
        exchange: payload.exchange,
        incomingAction: normalizedAction,
      },
      queryRunner,
    );

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

  private buildTradeSignals(
    userTradingAccounts: { userId: number; id: number }[],
    payload: Pick<
      ICreateAlertSnapshot,
      | "ticker"
      | "close"
      | "exchange"
      | "alertTime"
      | "executionMode"
      | "entryRef"
      | "orderType"
      | "limitPrice"
      | "stopPrice"
      | "stopLoss"
      | "takeProfit"
      | "stopLossDistance"
      | "takeProfitDistance"
      | "stopLossAmount"
      | "takeProfitAmount"
      | "trailingStopLoss"
      | "guaranteedStopLoss"
      | "stopLossTriggerMethod"
      | "trailingTakeProfitActivationDistance"
      | "trailingTakeProfitDistance"
      | "breakEvenActivationDistance"
      | "breakEvenOffsetDistance"
      | "trailingStopLossDistance"
      | "instrumentType"
      | "product"
      | "underlying"
      | "expiry"
      | "optionType"
      | "strike"
      | "tradingSymbol"
    >,
    snapshotId: number,
    normalizedAction: "BUY" | "SELL" | "HOLD",
    assetType: AssetType,
    volume: number,
    context?: {
      adminStrategyTradeId?: number | null;
      strategyId?: number | null;
      planId?: number | null;
      subscriptionId?: number | null;
    }
  ): ICreateTradeSignal[] {
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
      assetType: assetType as any,
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
      trailingTakeProfitActivationDistance:
        payload.trailingTakeProfitActivationDistance ?? null,
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
    }));
  }

  /**
   * Validate + normalize the explicit Indian instrument fields on an alert.
   * Defaults: EQUITY + DELIVERY when omitted (backward-compatible with old alerts).
   * Throws on inconsistent option/future payloads so bad alerts fail fast.
   */
  private normalizeIndianInstrument(payload: ICreateAlertSnapshot): void {
    if (payload.market !== MarketType.INDIAN) return;

    const up = (v: unknown) => (v == null ? null : String(v).trim().toUpperCase());
    const instrumentType = (up(payload.instrumentType) as any) || "EQUITY";
    const product = (up(payload.product) as any) || "INTRADAY";
    const optionType = up(payload.optionType) as any;

    if (!["EQUITY", "FUTURES", "OPTIONS"].includes(instrumentType)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "invalid_instrumentType" };
    }
    if (!["INTRADAY", "DELIVERY", "MARGIN"].includes(product)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "invalid_product" };
    }

    if (instrumentType === "OPTIONS") {
      const hasExplicit = Boolean(payload.tradingSymbol);
      if (!hasExplicit) {
        if (!["CE", "PE"].includes(optionType ?? "")) {
          throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "option_requires_optionType_CE_PE" };
        }
        if (payload.strike == null || !Number.isFinite(Number(payload.strike))) {
          throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "option_requires_strike" };
        }
        if (!payload.underlying || !payload.expiry) {
          throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "option_requires_underlying_and_expiry" };
        }
      }
    }
    if (instrumentType === "FUTURES" && !payload.tradingSymbol) {
      if (!payload.underlying || !payload.expiry) {
        throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "future_requires_underlying_and_expiry" };
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

  private async getBrokerIdsForPayload(payload: ICreateAlertSnapshot | ICreateStrategyManagedAlert) {
    const brokerCodes = this.getExecutionBrokerCodes(payload);
    if (brokerCodes) {
      return this.alertSnapshotDB.getBrokerIdByCodes(payload.market, brokerCodes);
    }
    return this.alertSnapshotDB.getBrokerId(payload.market);
  }

  private logStrategyExecutionResolution(args: {
    subscriptionId: number;
    userId: number;
    brokerIds: number[];
    eligibleOwnedAccountIds: number[];
    masterAccountIds: number[];
    followerAccountIds: number[];
    resolvedAccountIds: number[];
  }) {
    const {
      subscriptionId,
      userId,
      brokerIds,
      eligibleOwnedAccountIds,
      masterAccountIds,
      followerAccountIds,
      resolvedAccountIds,
    } = args;

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

  private async buildStrategySignalBatch(
    subscription: any,
    payload: ICreateAlertSnapshot,
    normalizedAction: "BUY" | "SELL" | "HOLD",
    assetType: AssetType,
    strategyInstance: any,
    queryRunner: QueryRunner,
    brokerIds: number[],
    options?: {
      executeActions?: boolean;
      adminStrategyTradeId?: number | null;
    },
  ) {
    const strategyPlanId = subscription.planId ?? strategyInstance.planId ?? null;
    const strategyContext = {
      adminStrategyTradeId: options?.adminStrategyTradeId ?? null,
      strategyId: Number(strategyInstance.strategyId),
      planId: strategyPlanId === null ? null : Number(strategyPlanId),
      subscriptionId: Number(subscription.id),
    };
    const snapshot = await this.alertSnapshotDB.create(
      {
        ...payload,
        userId: Number(subscription.userId),
        ...strategyContext,
      },
      queryRunner
    );

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
    const strategyExecution = await this.tradingAccountService.resolveStrategyExecutionTargets(
      Number(subscription.userId),
      Number(subscription.id),
      brokerIds
    );
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

    const shouldQueueCloseOpposite =
      normalizedAction !== "HOLD" &&
      userTradingAccounts.length > 0 &&
      (
        assetType === AssetType.FOREX ||
        assetType === AssetType.CRYPTO ||
        (payload.market === MarketType.INDIAN && this.normalizeExecutionMode(payload) === "OPEN")
      );

    if (shouldQueueCloseOpposite) {
      await this.queueEdgingCloseOppositeTrades(
        userTradingAccounts,
        {
          ...payload,
          userId: Number(subscription.userId),
        },
        normalizedAction as "BUY" | "SELL",
        queryRunner,
        assetType
      );
    }

    const tradeSignalPayload =
      userTradingAccounts.length > 0
        ? this.buildTradeSignals(
            userTradingAccounts,
            payload,
            snapshot.id,
            normalizedAction,
            assetType,
            Number(strategyInstance.volume),
            strategyContext
          )
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

  async create(payload: ICreateAlertSnapshot) {
    const queryRunner = AppDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const normalizedPayload = this.validateAndNormalizeExecutionFields(payload);
      this.normalizeIndianInstrument(normalizedPayload as ICreateAlertSnapshot);
      const executionMode = this.normalizeExecutionMode(normalizedPayload);
      const assetType = await this.isValidAssetType(normalizedPayload);
      const normalizedAction =
        this.normalizeAction(String(normalizedPayload.action ?? "")) ??
        (executionMode === "AMEND_SLTP" ? "HOLD" : null);
      if (!normalizedAction) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "invalid_action",
        };
      }

      const tokenSubscription =
        normalizedPayload.tokenType === "webhook" && normalizedPayload.subscriptionId
          ? await this.userSubscriptionDbService.getActiveSubscriptionById(
              Number(normalizedPayload.userId),
              Number(normalizedPayload.subscriptionId)
            )
          : null;
      let isValidPlan = tokenSubscription;
      if (!isValidPlan) {
        isValidPlan =
          await this.userSubscriptionService.subscriberPlanValidation(
            normalizedPayload.userId,
            normalizedPayload.market,
          );
      }
      if (!isValidPlan) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "invalid_subscription_plan",
        };
      }

      const matchedPlan = (isValidPlan as any)?.plan ?? null;
      if (
        tokenSubscription?.plan?.market?.code &&
        tokenSubscription.plan.market.code !== normalizedPayload.market
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "invalid_subscription_plan",
        };
      }
      const firstPlanStrategy = selectPrimaryPlanStrategy(matchedPlan?.planStrategies);
      if (firstPlanStrategy && normalizedPayload.tokenType === "webhook" && tokenSubscription) {
        const strategyInstances =
          await this.userSubscriptionDbService.getStrategyInstancesBySubscriptionIds([
            Number(tokenSubscription.id),
          ]);
        const strategyInstance = strategyInstances.find(
          (instance) =>
            Number(instance.subscriptionId) === Number(tokenSubscription.id) &&
            instance.status === UserStrategyStatus.ACTIVE &&
            Number(instance.strategyId) === Number(firstPlanStrategy.strategyId)
        );

        if (!strategyInstance) {
          throw {
            statusCode: HttpStatusCode._BAD_REQUEST,
            message: "strategy_instance_not_active",
          };
        }

        const brokerData = await this.getBrokerIdsForPayload(normalizedPayload);
        const strategyResult = await this.buildStrategySignalBatch(
          tokenSubscription,
          normalizedPayload,
          normalizedAction,
          assetType,
          strategyInstance,
          queryRunner,
          brokerData
        );

        await queryRunner.commitTransaction();
        return {
          snapshotId: Number(strategyResult.snapshotId),
          signalCount: strategyResult.signalCount,
          recipientCount: strategyResult.recipientCount,
        };
      }

      if (firstPlanStrategy) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "strategy_managed_plan_requires_admin_webhook",
        };
      }
      let snapshot: AlertSnapshot = await this.alertSnapshotDB.create(normalizedPayload, queryRunner);
      let brokerData: number[] = await this.getBrokerIdsForPayload(normalizedPayload);
      let userTradingAccounts: {
        userId: number;
        id: number;
      }[] = await this.tradingAccountService.getAllCopyTradingAccounts(normalizedPayload.userId, brokerData);

      const shouldQueueCloseOpposite =
        normalizedAction !== "HOLD" &&
        userTradingAccounts.length > 0 &&
        (
          assetType === AssetType.FOREX ||
          assetType === AssetType.CRYPTO ||
          (normalizedPayload.market === MarketType.INDIAN && executionMode === "OPEN")
        );

      if (shouldQueueCloseOpposite) {
        await this.queueEdgingCloseOppositeTrades(
          userTradingAccounts,
          normalizedPayload,
          normalizedAction as "BUY" | "SELL",
          queryRunner,
          assetType,
        );
      }

      let tradeSignalPayload: ICreateTradeSignal[] = [];
      if(userTradingAccounts.length > 0) {
        console.log("Creating trade signals for user", userTradingAccounts);
        tradeSignalPayload = this.buildTradeSignals(
          userTradingAccounts,
          normalizedPayload,
          snapshot.id,
          normalizedAction,
          assetType,
          normalizedPayload.volume
        );
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
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createForPlan(planId: number, payload: ICreateStrategyManagedAlert) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const normalizedPayload = this.validateAndNormalizeExecutionFields(
        payload as ICreateAlertSnapshot
      );
      this.normalizeIndianInstrument(normalizedPayload as ICreateAlertSnapshot);
      const executionMode = this.normalizeExecutionMode(normalizedPayload);
      const assetType = await this.isValidAssetType(normalizedPayload as ICreateAlertSnapshot);
      const normalizedAction =
        this.normalizeAction(String(normalizedPayload.action ?? "")) ??
        (executionMode === "AMEND_SLTP" ? "HOLD" : null);
      if (!normalizedAction) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "invalid_action",
        };
      }

      const plan = await this.subscriptionPlanService.getPlan(planId) as any;
      if (!plan?.isActive) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "inactive_plan",
        };
      }
      if (plan.market?.code && plan.market.code !== normalizedPayload.market) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "plan_market_mismatch",
        };
      }
      const primaryPlanStrategy = selectPrimaryPlanStrategy(plan.planStrategies);
      const strategy = primaryPlanStrategy?.strategy ?? plan.strategy ?? null;
      if (!strategy) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "plan_has_no_strategy",
        };
      }

      const subscriptions =
        await this.userSubscriptionDbService.getActiveStrategySubscriptionsForPlan(planId);
      const strategyInstances =
        await this.userSubscriptionDbService.getStrategyInstancesBySubscriptionIds(
          subscriptions.map((subscription) => Number(subscription.id))
        );
      const strategyInstanceMap = new Map(
        strategyInstances.map((instance) => [Number(instance.subscriptionId), instance])
      );

      const tradingStrengthAllowsExecution =
        normalizedPayload.tradingStrength !== null &&
        normalizedPayload.tradingStrength !== undefined &&
        Number(normalizedPayload.tradingStrength) > 40;
      let scheduleBlocked = false;
      let scheduleWindowIds: string[] = [];

      if (
        tradingStrengthAllowsExecution &&
        typeof (this.userDBService as any)?.getAdminStrategyTradeSchedule ===
          "function"
      ) {
        try {
          const schedule = await (this.userDBService as any).getAdminStrategyTradeSchedule();
          const evaluation = evaluateAdminStrategyTradeSchedule(
            schedule,
            new Date(Date.now())
          );
          scheduleBlocked = evaluation.isBlocked;
          scheduleWindowIds = evaluation.matchingWindowIds;
        } catch (error) {
          console.warn(
            "[ALERT] failed to evaluate admin strategy trade schedule; continuing without schedule gate",
            {
              planId,
              ticker: normalizedPayload.ticker,
              error: error instanceof Error ? error.message : error,
            }
          );
        }
      }

      const shouldExecuteActions =
        tradingStrengthAllowsExecution && !scheduleBlocked;
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
      const adminStrategyTrade = await this.alertSnapshotDB.createAdminStrategyTrade(
        {
          planId,
          strategyId: Number(strategy.id),
          source: "plan_webhook",
          action: normalizedAction,
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
          trailingTakeProfitActivationDistance:
            normalizedPayload.trailingTakeProfitActivationDistance ?? null,
          trailingTakeProfitDistance:
            normalizedPayload.trailingTakeProfitDistance ?? null,
          breakEvenActivationDistance:
            normalizedPayload.breakEvenActivationDistance ?? null,
          breakEvenOffsetDistance: normalizedPayload.breakEvenOffsetDistance ?? null,
          trailingStopLossDistance:
            normalizedPayload.trailingStopLossDistance ?? null,
          tradingStrength: normalizedPayload.tradingStrength ?? null,
          rawPayload: normalizedPayload as unknown as Record<string, unknown>,
          executionAllowed: shouldExecuteActions,
          scheduleBlocked,
          scheduleWindowIds,
        },
        queryRunner
      );
      const brokerData = shouldExecuteActions
        ? await this.getBrokerIdsForPayload(normalizedPayload)
        : [];
      let recipientCount = 0;
      let signalCount = 0;
      let snapshotCount = 0;

      for (const subscription of subscriptions) {
        if ((subscription as any).user?.isAdmin === true) continue;

        const instance = strategyInstanceMap.get(Number(subscription.id));
        if (!instance) continue;
        if (instance.status !== UserStrategyStatus.ACTIVE) continue;
        if (Number(instance.strategyId) !== Number(strategy.id)) continue;
        const result = await this.buildStrategySignalBatch(
          subscription,
          {
            ...normalizedPayload,
            userId: Number(subscription.userId),
          } as ICreateAlertSnapshot,
          normalizedAction,
          assetType,
          instance,
          queryRunner,
          brokerData,
          {
            executeActions: shouldExecuteActions,
            adminStrategyTradeId: Number(adminStrategyTrade.id),
          }
        );

        snapshotCount += result.snapshotCount;
        recipientCount += result.recipientCount;
        signalCount += result.signalCount;
      }

      const adminTradeStatus: AdminStrategyTradeStatus = !shouldExecuteActions
        ? "blocked"
        : signalCount > 0
          ? "fanned_out"
          : "no_signals";
      await this.alertSnapshotDB.updateAdminStrategyTradeFanout(
        Number(adminStrategyTrade.id),
        {
          recipientCount,
          snapshotCount,
          signalCount,
          status: adminTradeStatus,
        },
        queryRunner
      );

      await queryRunner.commitTransaction();
      return {
        adminStrategyTradeId: Number(adminStrategyTrade.id),
        planId,
        strategyId: Number(strategy.id),
        recipientCount,
        snapshotCount,
        signalCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async isValidAssetType(payload: ICreateAlertSnapshot) {
    try {
        const explained = AssetClassifier.explain({
          symbol: payload.ticker,
          exchange: payload.exchange,
          market: payload.market,
        });
        let assetType = explained.assetType;
        if (assetType === AssetType.UNKNOWN) {
          console.warn("[ALERT] unsupported_asset_type payload", {
            ticker: payload.ticker,
            exchange: payload.exchange,
            market: payload.market,
            classifier: explained,
          });
          throw {
            status: HttpStatusCode._BAD_REQUEST,
            message: "unsupported_asset_type",
          };
        }
        return assetType;
    } catch (error) {
      throw error;
    }
  }

  async getAlertHistory(userId: number, query: HistoryQuery) {
    try {
      const data = await this.alertSnapshotDB.getAlertHistory(userId, query);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getAdminAlertHistory(query: AdminHistoryQuery) {
    return this.alertSnapshotDB.getAdminAlertHistory(query);
  }

  

}
