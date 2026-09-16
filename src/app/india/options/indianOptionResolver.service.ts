import { BrokerInstrument } from "../../../entity/BrokerInstrument";
import { HttpStatusCode } from "../../../types/constants";
import {
  ICreateAlertSnapshot,
  IndianOptionType,
} from "../../broker/brokerAlerts/interfaces/alertSnapshot.interface";
import { BrokerInstrumentService } from "./brokerInstrument.service";
import { ZebuMarketDataClient, ZebuMarketQuote } from "./zebuMarketData.client";

export type OptionResolverConfig = {
  enabled: boolean;
  instrumentType: "OPTIONS";
  expiryMode: "NEAREST" | "MONTHLY";
  strikeMode: "ATM" | "ITM" | "OTM";
  strikeOffsetSteps: number;
  defaultLots: number;
  candidateStrikesEachSide: number;
  minDaysToExpiry: number;
  minVolumeLots: number;
  minTopDepthLots: number;
  maxSpreadPercent: number;
};

const DEFAULT_CONFIG: OptionResolverConfig = {
  enabled: false,
  instrumentType: "OPTIONS",
  expiryMode: "NEAREST",
  strikeMode: "ATM",
  strikeOffsetSteps: 0,
  defaultLots: 1,
  candidateStrikesEachSide: 2,
  minDaysToExpiry: 1,
  minVolumeLots: 5,
  minTopDepthLots: 1,
  maxSpreadPercent: 3,
};

type ScoredContract = {
  instrument: BrokerInstrument;
  quote: ZebuMarketQuote;
  score: number;
  spreadPercent: number;
};

function positiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizedEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const normalized = String(value ?? "").trim().toUpperCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function istDateAfter(days: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export class IndianOptionResolverService {
  constructor(
    private instruments = new BrokerInstrumentService(),
    private marketData = new ZebuMarketDataClient(),
  ) {}

  resolveConfig(...sources: Array<Record<string, any> | null | undefined>): OptionResolverConfig {
    const raw = sources.reduce<Record<string, any>>((result, source) => {
      const nested =
        source?.optionResolver && typeof source.optionResolver === "object"
          ? source.optionResolver
          : {};
      return { ...result, ...nested };
    }, {});

    return {
      enabled: raw.enabled === true,
      instrumentType: "OPTIONS",
      expiryMode: normalizedEnum(raw.expiryMode, ["NEAREST", "MONTHLY"], DEFAULT_CONFIG.expiryMode),
      strikeMode: normalizedEnum(raw.strikeMode, ["ATM", "ITM", "OTM"], DEFAULT_CONFIG.strikeMode),
      strikeOffsetSteps: positiveInteger(raw.strikeOffsetSteps, DEFAULT_CONFIG.strikeOffsetSteps),
      defaultLots: positiveInteger(raw.defaultLots, DEFAULT_CONFIG.defaultLots) || 1,
      candidateStrikesEachSide: positiveInteger(
        raw.candidateStrikesEachSide,
        DEFAULT_CONFIG.candidateStrikesEachSide,
      ),
      minDaysToExpiry: positiveInteger(raw.minDaysToExpiry, DEFAULT_CONFIG.minDaysToExpiry),
      minVolumeLots: positiveNumber(raw.minVolumeLots, DEFAULT_CONFIG.minVolumeLots),
      minTopDepthLots: positiveNumber(raw.minTopDepthLots, DEFAULT_CONFIG.minTopDepthLots),
      maxSpreadPercent: positiveNumber(raw.maxSpreadPercent, DEFAULT_CONFIG.maxSpreadPercent),
    };
  }

  isCompleteOption(payload: Partial<ICreateAlertSnapshot>): boolean {
    return (
      String(payload.instrumentType ?? "").toUpperCase() === "OPTIONS" &&
      Boolean(payload.tradingSymbol) &&
      Boolean(payload.underlying) &&
      Boolean(payload.expiry) &&
      ["CE", "PE"].includes(String(payload.optionType ?? "").toUpperCase()) &&
      payload.strike !== undefined &&
      payload.strike !== null &&
      Number.isFinite(Number(payload.strike))
    );
  }

  async resolve(
    payload: ICreateAlertSnapshot,
    config: OptionResolverConfig,
  ): Promise<ICreateAlertSnapshot> {
    if (!config.enabled || payload.market !== "INDIAN" || this.isCompleteOption(payload)) {
      return payload;
    }

    const sourceAction = String(payload.action ?? "").trim().toUpperCase();
    if (sourceAction !== "BUY" && sourceAction !== "SELL") {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_invalid_direction",
      };
    }
    const lotsValue = payload.lots ?? config.defaultLots;
    const lots = Number(lotsValue);
    if (!Number.isInteger(lots) || lots <= 0) {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_invalid_lots",
      };
    }

    const underlying = String(payload.underlying ?? payload.ticker ?? "")
      .split(":")
      .pop()!
      .trim()
      .toUpperCase();
    const exchange = this.derivativeExchange(payload.exchange);
    const optionType: IndianOptionType = sourceAction === "BUY" ? "CE" : "PE";
    const minExpiry = istDateAfter(config.minDaysToExpiry);
    const contracts = (await this.instruments.findOptionContracts({
      exchange,
      underlying,
      optionType,
      minExpiry,
    })).filter((contract) => contract.expiry && contract.expiry >= minExpiry);
    if (!contracts.length) {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_contracts_not_found",
      };
    }

    const expiry = this.selectExpiry(contracts, config.expiryMode);
    const expiryContracts = contracts.filter((contract) => contract.expiry === expiry);
    const quoteLtp = await this.marketData.getUnderlyingLtp(exchange, underlying);
    const fallbackLtp = Number(payload.close);
    const underlyingLtp = quoteLtp ?? (Number.isFinite(fallbackLtp) && fallbackLtp > 0 ? fallbackLtp : null);
    if (!underlyingLtp) {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_underlying_quote_unavailable",
      };
    }

    const strikes = Array.from(
      new Set(expiryContracts.map((contract) => Number(contract.strike)).filter(Number.isFinite)),
    ).sort((left, right) => left - right);
    const targetIndex = this.selectTargetStrikeIndex(
      strikes,
      underlyingLtp,
      optionType,
      config.strikeMode,
      config.strikeOffsetSteps,
    );
    const start = Math.max(0, targetIndex - config.candidateStrikesEachSide);
    const end = Math.min(strikes.length, targetIndex + config.candidateStrikesEachSide + 1);
    const candidateStrikes = new Set(strikes.slice(start, end));
    const candidates = expiryContracts.filter((contract) => candidateStrikes.has(Number(contract.strike)));
    const selected = await this.selectBestContract(candidates, targetIndex - start, config);
    const lotSize = Number(selected.instrument.lotSize);

    return {
      ...payload,
      action: "BUY" as any,
      sourceAction,
      ticker: underlying,
      underlying,
      exchange,
      instrumentType: "OPTIONS",
      optionType,
      strike: Number(selected.instrument.strike),
      expiry: selected.instrument.expiry,
      tradingSymbol: selected.instrument.tradingSymbol,
      brokerInstrumentId: Number(selected.instrument.id),
      instrumentToken: selected.instrument.brokerToken,
      tickSize: Number(selected.instrument.tickSize),
      product: "INTRADAY",
      close: selected.quote.ltp,
      volume: lots * lotSize,
      lots,
    };
  }

  private derivativeExchange(exchange?: string | null): string {
    const normalized = String(exchange ?? "NSE").trim().toUpperCase();
    if (["BSE", "BFO"].includes(normalized)) return "BFO";
    if (["MCX", "MCX_COMM"].includes(normalized)) return "MCX";
    return "NFO";
  }

  private selectExpiry(contracts: BrokerInstrument[], mode: "NEAREST" | "MONTHLY"): string {
    const expiries = Array.from(
      new Set(contracts.map((contract) => contract.expiry).filter((expiry): expiry is string => Boolean(expiry))),
    ).sort();
    if (!expiries.length) {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_expiry_not_found",
      };
    }
    if (mode === "NEAREST") return expiries[0];

    const monthly = new Map<string, string>();
    for (const expiry of expiries) {
      const month = expiry.slice(0, 7);
      if (!monthly.has(month) || expiry > monthly.get(month)!) monthly.set(month, expiry);
    }
    return Array.from(monthly.values()).sort()[0];
  }

  private selectTargetStrikeIndex(
    strikes: number[],
    ltp: number,
    optionType: IndianOptionType,
    mode: "ATM" | "ITM" | "OTM",
    offsetSteps: number,
  ): number {
    if (!strikes.length) {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_strike_not_found",
      };
    }
    let index = strikes.reduce(
      (best, strike, candidateIndex) =>
        Math.abs(strike - ltp) < Math.abs(strikes[best] - ltp) ? candidateIndex : best,
      0,
    );

    if (mode === "ITM") {
      const eligible = strikes
        .map((strike, candidateIndex) => ({ strike, candidateIndex }))
        .filter((item) => (optionType === "CE" ? item.strike <= ltp : item.strike >= ltp));
      if (eligible.length) {
        index = eligible.reduce((best, item) =>
          Math.abs(item.strike - ltp) < Math.abs(best.strike - ltp) ? item : best,
        ).candidateIndex;
      }
    } else if (mode === "OTM") {
      const eligible = strikes
        .map((strike, candidateIndex) => ({ strike, candidateIndex }))
        .filter((item) => (optionType === "CE" ? item.strike >= ltp : item.strike <= ltp));
      if (eligible.length) {
        index = eligible.reduce((best, item) =>
          Math.abs(item.strike - ltp) < Math.abs(best.strike - ltp) ? item : best,
        ).candidateIndex;
      }
    }

    const direction =
      mode === "ITM"
        ? optionType === "CE"
          ? -1
          : 1
        : optionType === "CE"
          ? 1
          : -1;
    return Math.max(0, Math.min(strikes.length - 1, index + direction * offsetSteps));
  }

  private async selectBestContract(
    contracts: BrokerInstrument[],
    targetCandidateIndex: number,
    config: OptionResolverConfig,
  ): Promise<ScoredContract> {
    const scored: ScoredContract[] = [];
    let quoteFailures = 0;
    let spreadFailures = 0;

    for (let index = 0; index < contracts.length; index += 1) {
      let quote: ZebuMarketQuote;
      try {
        quote = await this.marketData.getQuote(contracts[index].exchange, contracts[index].brokerToken);
      } catch {
        quoteFailures += 1;
        continue;
      }
      if (!quote.ltp || !quote.bid || !quote.ask || quote.ask <= quote.bid) {
        quoteFailures += 1;
        continue;
      }
      const lotSize = Number(contracts[index].lotSize);
      const minVolume = lotSize * config.minVolumeLots;
      const minDepth = lotSize * config.minTopDepthLots;
      if (quote.volume < minVolume || quote.bidQty < minDepth || quote.askQty < minDepth) continue;

      const spreadPercent = ((quote.ask - quote.bid) / ((quote.ask + quote.bid) / 2)) * 100;
      if (spreadPercent > config.maxSpreadPercent) {
        spreadFailures += 1;
        continue;
      }
      const spreadQuality = Math.max(0, 1 - spreadPercent / config.maxSpreadPercent);
      const volumeQuality = Math.min(1, quote.volume / Math.max(minVolume * 5, 1));
      const depthQuality = Math.min(1, Math.min(quote.bidQty, quote.askQty) / Math.max(minDepth * 5, 1));
      const liquidityQuality = (volumeQuality + depthQuality) / 2;
      const distanceQuality = Math.max(
        0,
        1 - Math.abs(index - targetCandidateIndex) / Math.max(contracts.length - 1, 1),
      );
      scored.push({
        instrument: contracts[index],
        quote,
        spreadPercent,
        score: spreadQuality * 0.5 + liquidityQuality * 0.3 + distanceQuality * 0.2,
      });
    }

    scored.sort(
      (left, right) =>
        right.score - left.score ||
        left.spreadPercent - right.spreadPercent ||
        Math.abs(Number(left.instrument.strike)) - Math.abs(Number(right.instrument.strike)),
    );
    if (scored[0]) return scored[0];

    throw {
      statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
      message:
        quoteFailures === contracts.length
          ? "option_quote_unavailable"
          : spreadFailures > 0 && spreadFailures + quoteFailures === contracts.length
            ? "option_spread_too_wide"
            : "option_no_liquid_contract",
    };
  }
}
