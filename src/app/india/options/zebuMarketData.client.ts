import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { HttpStatusCode } from "../../../types/constants";

export type ZebuMarketQuote = {
  token: string;
  exchange: string;
  tradingSymbol: string | null;
  ltp: number;
  volume: number;
  bid: number;
  ask: number;
  bidQty: number;
  askQty: number;
  raw: Record<string, unknown>;
};

type MarketDataConfig = {
  baseUrl: string;
  uid: string;
  accessToken: string;
  timeoutMs: number;
};

function asObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function positiveNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export class ZebuMarketDataClient {
  private async getConfig(): Promise<MarketDataConfig> {
    const accountId = Number(process.env.ZEBU_MARKET_DATA_TRADING_ACCOUNT_ID);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_quote_account_not_configured",
      };
    }

    const account = await AppDataSource.getRepository(UserTradingAccount).findOne({
      where: { id: accountId } as any,
      relations: ["broker"],
    });
    const meta = asObject(account?.accountMeta);
    const zebu = asObject(meta.zebu);
    const uid = firstText(zebu.uid, zebu.clientId, meta.uid, meta.clientId, account?.accountId);
    const accessToken = firstText(zebu.accessToken, account?.accessToken);
    let baseUrl = firstText(zebu.baseUrl, process.env.ZEBU_BASE_URL, "https://go.mynt.in/NorenWClientTP")!;
    baseUrl = baseUrl.replace(/NorenWClientWeb/gi, "NorenWClientTP").replace(/\/+$/, "");

    if (!account || String(account.broker?.code ?? "").toUpperCase() !== "ZEBU" || !uid || !accessToken) {
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_quote_account_unavailable",
      };
    }

    return {
      baseUrl,
      uid: uid.replace(/_U$/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      accessToken,
      timeoutMs: Number(process.env.ZEBU_REQUEST_TIMEOUT_MS ?? 15000),
    };
  }

  private async request(action: "SearchScrip" | "GetQuotes", jData: Record<string, unknown>) {
    const config = await this.getConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json,text/plain,*/*",
        },
        body: `jData=${encodeURIComponent(JSON.stringify({ uid: config.uid, ...jData }))}&jKey=${encodeURIComponent(config.accessToken)}`,
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || String(payload.stat ?? "").toLowerCase() === "not_ok") {
        throw {
          statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
          message: "option_quote_unavailable",
          data: { action, status: response.status, payload },
        };
      }
      return payload;
    } catch (error: any) {
      if (error?.statusCode) throw error;
      throw {
        statusCode: HttpStatusCode._UNPROCESSABLE_ENTITY,
        message: "option_quote_unavailable",
        data: { action, error: error?.message ?? String(error) },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getQuote(exchange: string, token: string): Promise<ZebuMarketQuote> {
    const raw = asObject(await this.request("GetQuotes", {
      exch: exchange,
      token,
    }));
    return {
      token: firstText(raw.token, token)!,
      exchange: firstText(raw.exch, exchange)!.toUpperCase(),
      tradingSymbol: firstText(raw.tsym),
      ltp: positiveNumber(raw.lp ?? raw.ltp ?? raw.lastPrice),
      volume: positiveNumber(raw.v ?? raw.volume),
      bid: positiveNumber(raw.bp1 ?? raw.bid),
      ask: positiveNumber(raw.sp1 ?? raw.ask),
      bidQty: positiveNumber(raw.bq1 ?? raw.bidQty),
      askQty: positiveNumber(raw.sq1 ?? raw.askQty),
      raw,
    };
  }

  async getUnderlyingLtp(exchange: string, underlying: string): Promise<number | null> {
    try {
      const normalizedExchange = exchange === "NFO" ? "NSE" : exchange === "BFO" ? "BSE" : exchange;
      const normalizedUnderlying = underlying.trim().toUpperCase();
      const payload = await this.request("SearchScrip", {
        exch: normalizedExchange,
        stext: normalizedUnderlying,
      });
      const values = Array.isArray(payload?.values) ? payload.values : [];
      const normalizedRoot = normalizedUnderlying.replace(/[^A-Z0-9]/g, "");
      const exact = values.find((row: any) => {
        const symbol = String(row?.tsym ?? "").trim().toUpperCase().replace(/-EQ$/i, "");
        return symbol.replace(/[^A-Z0-9]/g, "") === normalizedRoot;
      });
      const token = firstText(exact?.token);
      if (!token) return null;
      const quote = await this.getQuote(normalizedExchange, token);
      return quote.ltp > 0 ? quote.ltp : null;
    } catch {
      return null;
    }
  }
}
