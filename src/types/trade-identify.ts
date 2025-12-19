// assetClassifier.ts

export enum AssetType {
  FOREX = "FOREX",
  CRYPTO = "CRYPTO",
  STOCK = "STOCK",
  INDEX = "INDEX",
  COMMODITY = "COMMODITY",
  FUTURES = "FUTURES",
  UNKNOWN = "UNKNOWN",
}

export type DetectInput = {
  symbol?: string | null; // can be "DOGE" or "BINANCE:BTCUSDT" etc.
  exchange?: string | null; // optional separate exchange
  market?: string | null; // optional upstream "crypto/forex/stock"
};

type DetectResult = {
  assetType: AssetType;
  reason: string;
  normalized: {
    symbol: string;
    exchange: string;
    market: string;
    base: string;
    quote: string;
  };
};

export class AssetClassifier {
  // -----------------------------
  // Fast lookups & regex (compiled once)
  // -----------------------------
  private static readonly FX_MARKETS = new Set(["FOREX", "FX", "CURRENCY"]);
  private static readonly CRYPTO_MARKETS = new Set(["CRYPTO", "CRYPTOS"]);
  private static readonly STOCK_MARKETS = new Set([
    "STOCK",
    "EQUITY",
    "SHARES",
  ]);
  private static readonly FUTURES_MARKETS = new Set(["FUTURES"]);

  /**
   * Exchange families (heuristic). Not "one-off"; these are categories.
   * Keep this small & conservative — it's used as a hint, not absolute truth.
   */
  private static readonly CRYPTO_EXCHANGES = new Set([
    "BINANCE",
    "BINANCEUS",
    "COINBASE",
    "KRAKEN",
    "BYBIT",
    "OKX",
    "BITSTAMP",
    "BITFINEX",
    "HUOBI",
    "GEMINI",
    "KUCOIN",
    // TradingView synthetic/data feeds
    "CRYPTOCAP",
    "CRYPTO",
    "CRYPTOINDEX",
  ]);

  private static readonly FX_EXCHANGES = new Set([
    "OANDA",
    "FX",
    "FOREX",
    "FXCM",
    "FX_IDC",
    "SAXO",
    "PEPPERSTONE",
    "ICMARKETS",
    "FPMARKETS",
    "EIGHTCAP",
    "XM",
    "EXNESS",
    "CAPITALCOM",
  ]);

  // Common fiat codes (partial but high-signal)
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

  // Common crypto quote currencies
  private static readonly CRYPTO_QUOTES = new Set([
    "USDT",
    "USDC",
    "BUSD",
    "DAI",
    "TUSD",
    "BTC",
    "ETH",
    "BNB",
    "SOL",
    "XRP",
    "USD",
    "EUR", // some crypto pairs use fiat quotes directly
  ]);

  // Metals / commodities symbols seen broadly
  private static readonly COMMODITY_PREFIXES = [
    "XAU",
    "XAG",
    "XPT",
    "XPD", // metals
    "WTI",
    "BRENT",
    "NG",
    "NATGAS",
    "OIL", // energy
  ];

  private static readonly INDEX_TOKENS = [
    "SPX",
    "SP500",
    "NDX",
    "DJI",
    "DOW",
    "NAS100",
    "US30",
    "US500",
    "DE40",
    "GER40",
    "DAX",
    "UK100",
    "FTSE",
    "JP225",
    "NIKKEI",
    "HK50",
  ];

  // precompiled regex
  private static readonly RE_FX_6 = /^[A-Z]{6}$/; // EURUSD
  private static readonly RE_TV_PREFIX = /^([A-Z0-9_]+):(.+)$/; // BINANCE:BTCUSDT
  private static readonly RE_FUTURES_SUFFIX = /[FGHJKMNQUVXZ]\d{1,2}$/; // e.g. ESZ25 (heuristic)
  private static readonly RE_NUMBERY = /^[0-9.]+$/;

  // tiny cache (helps if same symbol repeats frequently)
  private static readonly CACHE = new Map<string, DetectResult>();
  private static readonly CACHE_MAX = 2000;

  // -----------------------------
  // Public API
  // -----------------------------
  static detect(input: DetectInput): AssetType {
    return this.detectWithReason(input).assetType;
  }

  static explain(input: DetectInput): DetectResult {
    return this.detectWithReason(input);
  }

  static routeEngine(
    assetType: AssetType
  ): "MT5" | "CRYPTO_API" | "MANUAL_REVIEW" {
    if (assetType === AssetType.CRYPTO) return "CRYPTO_API";
    if (
      assetType === AssetType.FOREX ||
      assetType === AssetType.INDEX ||
      assetType === AssetType.COMMODITY ||
      assetType === AssetType.FUTURES
    )
      return "MT5";
    return "MANUAL_REVIEW";
  }

  // -----------------------------
  // Core detection (professional priority order)
  // -----------------------------
  private static detectWithReason(input: DetectInput): DetectResult {
    const rawSymbol = (input.symbol ?? "").trim();
    const rawExchange = (input.exchange ?? "").trim();
    const rawMarket = (input.market ?? "").trim();

    // cache key includes everything, because TradingView can send same symbol with different exchange
    const cacheKey = `${rawSymbol}||${rawExchange}||${rawMarket}`.toUpperCase();
    const cached = this.CACHE.get(cacheKey);
    if (cached) return cached;

    const parsed = this.parseTradingViewSymbol(rawSymbol, rawExchange);
    const market = this.norm(rawMarket);
    const exchange = parsed.exchange;
    const symbol = parsed.symbol;

    // 1) If market is provided, trust it (highest priority)
    if (this.FX_MARKETS.has(market))
      return this.cache(
        cacheKey,
        this.result(
          AssetType.FOREX,
          "market=forex/fx",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    if (this.CRYPTO_MARKETS.has(market))
      return this.cache(
        cacheKey,
        this.result(
          AssetType.CRYPTO,
          "market=crypto",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    if (this.STOCK_MARKETS.has(market))
      return this.cache(
        cacheKey,
        this.result(
          AssetType.STOCK,
          "market=stock/equity",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    if (this.FUTURES_MARKETS.has(market))
      return this.cache(
        cacheKey,
        this.result(
          AssetType.FUTURES,
          "market=futures",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );

    // 2) Exchange family hint (second priority)
    // NOTE: exchange alone is not absolute truth; we use it as a strong hint.
    if (this.CRYPTO_EXCHANGES.has(exchange)) {
      // if exchange is crypto-family and symbol is not obviously forex -> crypto
      if (!this.looksLikeForexPair(symbol)) {
        return this.cache(
          cacheKey,
          this.result(
            AssetType.CRYPTO,
            "exchange=crypto-family",
            symbol,
            exchange,
            market,
            parsed.base,
            parsed.quote
          )
        );
      }
    }
    if (this.FX_EXCHANGES.has(exchange) && this.looksLikeForexPair(symbol)) {
      return this.cache(
        cacheKey,
        this.result(
          AssetType.FOREX,
          "exchange=fx-family + fx-pair",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    }

    // 3) Symbol heuristics (most important when exchange/market ambiguous)

    // 3a) Futures heuristic (optional)
    if (this.RE_FUTURES_SUFFIX.test(symbol)) {
      return this.cache(
        cacheKey,
        this.result(
          AssetType.FUTURES,
          "symbol=futures-like (suffix)",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    }

    // 3b) Forex: 6 letters and both parts are known fiat (EURUSD)
    if (this.looksLikeForexPair(symbol)) {
      return this.cache(
        cacheKey,
        this.result(
          AssetType.FOREX,
          "symbol=fx-pair",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    }

    // 3c) Crypto pairs & base-only crypto tokens
    const cryptoType = this.detectCryptoBySymbol(symbol);
    if (cryptoType) {
      return this.cache(
        cacheKey,
        this.result(
          AssetType.CRYPTO,
          cryptoType,
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    }

    // 3d) Commodities
    if (this.looksLikeCommodity(symbol)) {
      return this.cache(
        cacheKey,
        this.result(
          AssetType.COMMODITY,
          "symbol=commodity-like",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    }

    // 3e) Indices
    if (this.looksLikeIndex(symbol)) {
      return this.cache(
        cacheKey,
        this.result(
          AssetType.INDEX,
          "symbol=index-like",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    }

    // 4) Last resort: if exchange is strongly crypto-family, assume crypto (covers CRYPTOCAP:DOGE)
    if (this.CRYPTO_EXCHANGES.has(exchange)) {
      return this.cache(
        cacheKey,
        this.result(
          AssetType.CRYPTO,
          "fallback=crypto-family",
          symbol,
          exchange,
          market,
          parsed.base,
          parsed.quote
        )
      );
    }

    // 5) Unknown
    return this.cache(
      cacheKey,
      this.result(
        AssetType.UNKNOWN,
        "no-match",
        symbol,
        exchange,
        market,
        parsed.base,
        parsed.quote
      )
    );
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  private static parseTradingViewSymbol(
    symbolRaw: string,
    exchangeRaw: string
  ) {
    const exchangeFromArg = this.norm(exchangeRaw);
    let exchange = exchangeFromArg;
    let symbol = this.norm(symbolRaw);
    let base = "";
    let quote = "";

    // If symbol includes TradingView prefix "EXCHANGE:SYMBOL"
    const m = this.RE_TV_PREFIX.exec(symbol);
    if (m) {
      exchange = this.norm(m[1]) || exchange;
      symbol = this.norm(m[2]);
    }

    // Remove common separators inside symbol
    // e.g. "BTC/USDT", "BTC-USDT", "BTC_USDT"
    const clean = symbol.replace(/[\/\-_]/g, "");
    symbol = clean;

    // try to split base/quote for pairs (crypto & forex)
    const split = this.splitBaseQuote(symbol);
    base = split.base;
    quote = split.quote;

    return { exchange, symbol, base, quote };
  }

  private static splitBaseQuote(sym: string): { base: string; quote: string } {
    // Common quoted endings (longer first)
    const candidates = Array.from(this.CRYPTO_QUOTES).sort(
      (a, b) => b.length - a.length
    );
    for (const q of candidates) {
      if (sym.length > q.length && sym.endsWith(q)) {
        return { base: sym.slice(0, -q.length), quote: q };
      }
    }
    // Forex pairs: 6 letters => 3+3 split
    if (sym.length === 6)
      return { base: sym.slice(0, 3), quote: sym.slice(3, 6) };
    return { base: "", quote: "" };
  }

  private static looksLikeForexPair(symbol: string): boolean {
    if (!this.RE_FX_6.test(symbol)) return false;
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    // require both to be common fiat for high precision
    return this.FIAT_QUOTES.has(base) && this.FIAT_QUOTES.has(quote);
  }

  private static detectCryptoBySymbol(symbol: string): string | null {
    // Pair-based crypto (BTCUSDT, ETHUSD, SOLUSDC etc.)
    const { base, quote } = this.splitBaseQuote(symbol);
    if (base && quote && this.CRYPTO_QUOTES.has(quote)) {
      // avoid misclassifying forex like EURUSD as crypto
      if (
        base.length === 3 &&
        quote.length === 3 &&
        this.FIAT_QUOTES.has(base) &&
        this.FIAT_QUOTES.has(quote)
      )
        return null;
      return "symbol=crypto-pair";
    }

    // Base-only crypto token (DOGE, BTC, ETH) — very common in CRYPTOCAP.
    // Professional heuristic: base-only is crypto only if it is NOT fiat-like and not purely numeric.
    if (symbol.length >= 2 && symbol.length <= 6) {
      if (this.RE_NUMBERY.test(symbol)) return null;
      if (this.FIAT_QUOTES.has(symbol)) return null; // USD, EUR, etc
      // Typical crypto tickers are 2-6 uppercase letters
      if (/^[A-Z]{2,6}$/.test(symbol)) return "symbol=crypto-base-token";
    }

    return null;
  }

  private static looksLikeCommodity(symbol: string): boolean {
    // metals often appear as XAUUSD etc, but if it's XAU... treat as commodity
    for (const p of this.COMMODITY_PREFIXES) {
      if (symbol.startsWith(p)) return true;
    }
    return false;
  }

  private static looksLikeIndex(symbol: string): boolean {
    for (const t of this.INDEX_TOKENS) {
      if (symbol.includes(t)) return true;
    }
    return false;
  }

  private static result(
    assetType: AssetType,
    reason: string,
    symbol: string,
    exchange: string,
    market: string,
    base: string,
    quote: string
  ): DetectResult {
    return {
      assetType,
      reason,
      normalized: { symbol, exchange, market, base, quote },
    };
  }

  private static cache(key: string, res: DetectResult): DetectResult {
    if (this.CACHE.size >= this.CACHE_MAX) {
      // cheap eviction: delete first inserted key
      const first = this.CACHE.keys().next().value;
      if (first) this.CACHE.delete(first);
    }
    this.CACHE.set(key, res);
    return res;
  }

  private static norm(v?: string | null): string {
    return (v ?? "").trim().toUpperCase();
  }
}
