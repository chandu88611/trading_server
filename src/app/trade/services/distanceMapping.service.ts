import { AssetClassifier } from "../../../types/trade-identify";

export type DistanceBroker = "CTRADER" | "MT5";

export type CTraderDistanceMeta = {
  pipPosition?: number | null;
};

export type Mt5DistanceMeta = {
  digits?: number | null;
  point?: number | string | null;
  tickSize?: number | string | null;
  pipSize?: number | string | null;
};

export type DistanceMappingInput = {
  broker: DistanceBroker;
  symbol: string;
  requestedDistance: number | string;
  cTraderMeta?: CTraderDistanceMeta | null;
  mt5Meta?: Mt5DistanceMeta | null;
};

export type DistanceMappingResult = {
  requestedDistance: number;
  symbol: string;
  unitSize: number;
  priceDistance: number;
  source:
    | "ctrader_pip_position"
    | "mt5_pip_size"
    | "mt5_point_digits"
    | "symbol_override"
    | "family_rule";
};

const SYMBOL_UNIT_OVERRIDES: Record<string, number> = {
  XAUUSD: 0.1,
  XAGUSD: 0.01,
  XPTUSD: 0.01,
  XPDUSD: 0.01,
  WTI: 0.01,
  BRENT: 0.01,
  USOIL: 0.01,
  UKOIL: 0.01,
  XTIUSD: 0.01,
  XBRUSD: 0.01,
  NG: 0.01,
  NATGAS: 0.01,
  US30: 1,
  US500: 1,
  NAS100: 1,
  SPX500: 1,
  UK100: 1,
  DE40: 1,
  GER40: 1,
  HK50: 1,
  JP225: 1,
  NIFTY: 1,
  BANKNIFTY: 1,
  FINNIFTY: 1,
  MIDCPNIFTY: 1,
  SENSEX: 1,
  BANKEX: 1,
};

export class DistanceMappingService {
  private static readonly FX_6 = /^[A-Z]{6}$/;
  private static readonly FIAT_QUOTES = new Set([
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CHF",
    "AUD",
    "NZD",
    "CAD",
    "SEK",
    "NOK",
    "DKK",
    "SGD",
    "HKD",
    "INR",
    "CNY",
    "MXN",
    "ZAR",
    "TRY",
    "PLN",
    "BRL",
  ]);

  resolve(input: DistanceMappingInput): DistanceMappingResult {
    const symbol = String(input.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      throw new Error("distance_mapping_unavailable");
    }

    const requestedDistance = this.normalizeRequestedDistance(input.requestedDistance);
    const metadataUnitSize = this.resolveMetadataUnitSize(input.broker, input.cTraderMeta, input.mt5Meta);
    if (metadataUnitSize) {
      return {
        requestedDistance,
        symbol,
        unitSize: metadataUnitSize.unitSize,
        priceDistance: requestedDistance * metadataUnitSize.unitSize,
        source: metadataUnitSize.source,
      };
    }

    const override = SYMBOL_UNIT_OVERRIDES[symbol];
    if (Number.isFinite(override) && override > 0) {
      return {
        requestedDistance,
        symbol,
        unitSize: override,
        priceDistance: requestedDistance * override,
        source: "symbol_override",
      };
    }

    const familyRule = this.resolveFamilyUnitSize(symbol);
    if (familyRule) {
      return {
        requestedDistance,
        symbol,
        unitSize: familyRule,
        priceDistance: requestedDistance * familyRule,
        source: "family_rule",
      };
    }

    throw new Error("distance_mapping_unavailable");
  }

  private normalizeRequestedDistance(value: number | string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      throw new Error("invalid_distance_value");
    }
    return parsed;
  }

  private resolveMetadataUnitSize(
    broker: DistanceBroker,
    cTraderMeta?: CTraderDistanceMeta | null,
    mt5Meta?: Mt5DistanceMeta | null,
  ): Pick<DistanceMappingResult, "unitSize" | "source"> | null {
    if (broker === "CTRADER") {
      if (cTraderMeta?.pipPosition !== undefined && cTraderMeta?.pipPosition !== null) {
        const pipPosition = Number(cTraderMeta.pipPosition);
        if (!Number.isFinite(pipPosition) || pipPosition < 0) {
          return null;
        }
        return {
          unitSize: Math.pow(10, -pipPosition),
          source: "ctrader_pip_position",
        };
      }
      return null;
    }

    const pipSize = Number(mt5Meta?.pipSize);
    if (Number.isFinite(pipSize) && pipSize > 0) {
      return {
        unitSize: pipSize,
        source: "mt5_pip_size",
      };
    }

    const point = Number(mt5Meta?.point);
    const digits = Number(mt5Meta?.digits);
    if (Number.isFinite(point) && point > 0) {
      const pipMultiplier = Number.isFinite(digits) && (digits === 3 || digits === 5) ? 10 : 1;
      return {
        unitSize: point * pipMultiplier,
        source: "mt5_point_digits",
      };
    }

    const tickSize = Number(mt5Meta?.tickSize);
    if (Number.isFinite(tickSize) && tickSize > 0) {
      return {
        unitSize: tickSize,
        source: "mt5_point_digits",
      };
    }

    return null;
  }

  private resolveFamilyUnitSize(symbol: string): number | null {
    if (this.looksLikeStandardForex(symbol)) {
      return symbol.endsWith("JPY") ? 0.01 : 0.0001;
    }

    const assetType = AssetClassifier.detect({ symbol });
    if (assetType === "COMMODITY") {
      return 0.01;
    }
    if (assetType === "INDEX") {
      return 1;
    }

    return null;
  }

  private looksLikeStandardForex(symbol: string): boolean {
    if (!DistanceMappingService.FX_6.test(symbol)) return false;
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    return (
      DistanceMappingService.FIAT_QUOTES.has(base) &&
      DistanceMappingService.FIAT_QUOTES.has(quote)
    );
  }
}
