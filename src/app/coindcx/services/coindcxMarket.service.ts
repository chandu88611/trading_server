/** Decimal arithmetic avoids binary-float under-rounding (for example 0.3 / 0.1). */
export class CoinDCXValidationError extends Error { readonly statusCode = 400; }

type Decimal = { value: bigint; scale: number };
function decimal(input: number | string): Decimal {
  const text = String(input).toLowerCase();
  const match = /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/.exec(text);
  if (!match || !Number.isFinite(Number(text))) throw new CoinDCXValidationError("coindcx_invalid_decimal");
  const scale = (match[2]?.length ?? 0) - Number(match[3] ?? 0);
  if (Math.abs(scale) > 100) throw new CoinDCXValidationError("coindcx_invalid_decimal");
  return { value: BigInt(match[1] + (match[2] ?? "")) * 10n ** BigInt(Math.max(-scale, 0)), scale: Math.max(scale, 0) };
}
function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [a.value * 10n ** BigInt(scale - a.scale), b.value * 10n ** BigInt(scale - b.scale), scale];
}
function compare(a: Decimal, b: Decimal) { const [x, y] = align(a, b); return x < y ? -1 : x > y ? 1 : 0; }
function stepped(raw: number | string, step: number | string, nearest: boolean): number {
  const [value, increment, scale] = align(decimal(raw), decimal(step));
  if (increment <= 0n) throw new CoinDCXValidationError("coindcx_invalid_step");
  const units = nearest ? (value * 2n + increment) / (2n * increment) : value / increment;
  const result = units * increment;
  const digits = result.toString().padStart(scale + 1, "0");
  return Number(scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits);
}
export function quantizeQuantity(raw: number | string, step: number | string, minQty: number | string = 0) {
  const quantity = stepped(raw, step, false);
  if (quantity <= 0 || compare(decimal(quantity), decimal(minQty)) < 0) throw new CoinDCXValidationError("coindcx_below_min_quantity");
  return quantity;
}
export function quantizePrice(raw: number | string, tick: number | string) {
  const price = stepped(raw, tick, true);
  if (price <= 0) throw new CoinDCXValidationError("coindcx_invalid_price");
  return price;
}
export interface MarketRules {
  quantityStep: number; tickSize: number; minQuantity: number; minNotional: number;
  maxQuantity?: number; maxMarketQuantity?: number; minMarketQuantity?: number;
  baseAsset: string; quoteAsset: string;
}
export function assertMinNotional(quantity: number, price: number, minNotional: number) {
  const q = decimal(quantity), p = decimal(price);
  if (compare({ value: q.value * p.value, scale: q.scale + p.scale }, decimal(minNotional)) < 0) {
    throw new CoinDCXValidationError("coindcx_below_min_notional");
  }
}
export function prepareOrder(quantity: number, price: number, rules: MarketRules, market = false) {
  const normalizedPrice = quantizePrice(price, rules.tickSize);
  const normalizedQuantity = quantizeQuantity(quantity, rules.quantityStep, Math.max(rules.minQuantity, market ? rules.minMarketQuantity ?? 0 : 0));
  const max = market ? rules.maxMarketQuantity ?? rules.maxQuantity : rules.maxQuantity;
  if (max && normalizedQuantity > max) throw new CoinDCXValidationError("coindcx_above_max_quantity");
  // A market order's estimate is not a submitted limit price.
  assertMinNotional(normalizedQuantity, market ? price : normalizedPrice, rules.minNotional);
  return { quantity: normalizedQuantity, price: normalizedPrice };
}
export function spotExitQuantity(entryQuantity: number, availableBalance: number, step: number, minQty: number) {
  if (!Number.isFinite(availableBalance) || availableBalance < 0) throw new CoinDCXValidationError("coindcx_available_balance_unavailable");
  return quantizeQuantity(Math.min(entryQuantity, availableBalance), step, minQty);
}

type FetchPublic = (path: string, query?: Record<string, any>) => Promise<any>;
export class CoinDCXMarketService {
  private static cache = new Map<string, { expires: number; value: any }>();
  private static pending = new Map<string, Promise<any>>();
  constructor(private fetchPublic: FetchPublic, private namespace = "coindcx", private now = Date.now) {}
  private async cached(key: string, fetch: () => Promise<any>) {
    key = `${this.namespace}:${key}`;
    const cached = CoinDCXMarketService.cache.get(key);
    if (cached && cached.expires > this.now()) return cached.value;
    let pending = CoinDCXMarketService.pending.get(key);
    if (!pending) {
      pending = fetch().then(value => { CoinDCXMarketService.cache.set(key, { value, expires: this.now() + 3600000 }); return value; })
        .finally(() => CoinDCXMarketService.pending.delete(key));
      CoinDCXMarketService.pending.set(key, pending);
    }
    return pending;
  }
  async spot(symbol: string): Promise<MarketRules> {
    const rows = await this.cached("spot", async () => {
      const data = await this.fetchPublic("/exchange/v1/markets_details");
      if (!Array.isArray(data) || !data.length) throw new CoinDCXValidationError("coindcx_market_metadata_unavailable");
      return data;
    });
    const row = rows.find((r: any) => String(r.coindcx_name ?? r.symbol).toUpperCase() === symbol.toUpperCase());
    if (!row || String(row.status).toLowerCase() !== "active") throw new CoinDCXValidationError("coindcx_market_unavailable");
    // CoinDCX spot 'step' is quantity; base_currency_precision describes quote-price decimals.
    const precision = Number(row.base_currency_precision);
    return this.validate({ quantityStep: Number(row.quantity_step ?? row.step),
      tickSize: Number(row.price_increment ?? row.tick_size ?? (Number.isInteger(precision) && precision >= 0 && precision <= 18 ? 10 ** -precision : NaN)),
      minQuantity: Number(row.min_quantity), minNotional: row.min_notional == null ? NaN : Number(row.min_notional),
      maxQuantity: Number(row.max_quantity) || undefined, maxMarketQuantity: Number(row.max_quantity_market) || undefined,
      minMarketQuantity: Number(row.min_market_orders_qty) || undefined,
      baseAsset: row.target_currency_short_name, quoteAsset: row.base_currency_short_name });
  }
  async futures(pair: string, marginCurrency: string): Promise<MarketRules> {
    return this.cached(`futures:${pair}:${marginCurrency}`, async () => {
      const data = await this.fetchPublic("/exchange/v1/derivatives/futures/data/instrument", { pair, margin_currency_short_name: marginCurrency });
      const row = data?.instrument;
      if (!row || String(row.status).toLowerCase() !== "active") throw new CoinDCXValidationError("coindcx_market_unavailable");
      return this.validate({ quantityStep: Number(row.quantity_increment), tickSize: Number(row.price_increment),
        minQuantity: Math.max(Number(row.min_quantity), Number(row.min_trade_size ?? 0)), minNotional: row.min_notional == null ? NaN : Number(row.min_notional),
        maxQuantity: Number(row.max_quantity) || undefined, maxMarketQuantity: Number(row.max_market_order_quantity) || undefined,
        baseAsset: row.position_currency_short_name, quoteAsset: row.quote_currency_short_name });
    });
  }
  private validate(rules: MarketRules) {
    if (![rules.quantityStep, rules.tickSize].every(n => Number.isFinite(n) && n > 0)
      || ![rules.minQuantity, rules.minNotional].every(n => Number.isFinite(n) && n >= 0)
      || !rules.baseAsset || !rules.quoteAsset) throw new CoinDCXValidationError("coindcx_invalid_market_metadata");
    return rules;
  }
}
