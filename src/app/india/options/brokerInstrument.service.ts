import { inflateRawSync } from "zlib";
import AppDataSource from "../../../db/data-source";
import { BrokerInstrument } from "../../../entity/BrokerInstrument";
import { HttpStatusCode } from "../../../types/constants";

export type BrokerInstrumentMasterRow = {
  brokerCode: string;
  exchange: string;
  brokerToken: string;
  underlying: string;
  tradingSymbol: string;
  instrumentType: string;
  optionType: string | null;
  strike: number | null;
  expiry: string | null;
  lotSize: number;
  tickSize: number;
  raw: Record<string, unknown>;
};

const DEFAULT_MASTER_BASE_URL = "https://api.shoonya.com";
const DEFAULT_SEGMENTS = ["NFO", "BFO", "MCX"];
const SYNC_STALE_MS = 24 * 60 * 60 * 1000;

function normalizeSyncSegments(segments: string[]): string[] {
  const normalized = Array.from(
    new Set(segments.map((segment) => String(segment).trim().toUpperCase()).filter(Boolean)),
  );
  const invalid = normalized.filter((segment) => !DEFAULT_SEGMENTS.includes(segment));
  if (!normalized.length || invalid.length) {
    throw {
      statusCode: HttpStatusCode._BAD_REQUEST,
      message: "invalid_instrument_segment",
      data: { allowed: DEFAULT_SEGMENTS, invalid },
    };
  }
  return normalized;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function normalizeExpiry(value: string): string | null {
  const match = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/i.exec(value.trim());
  if (!match) return null;
  const months: Record<string, string> = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
  };
  const month = months[match[2].toUpperCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

function normalizeInstrumentType(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (normalized.startsWith("OPT")) return "OPTIONS";
  if (normalized.startsWith("FUT")) return "FUTURES";
  return normalized || "UNKNOWN";
}

function normalizeUnderlying(symbol: string, tradingSymbol: string, instrumentType: string): string {
  if (instrumentType === "OPTIONS" || instrumentType === "FUTURES") {
    const derived = /^(.+?)\d{2}[A-Z]{3}/.exec(tradingSymbol)?.[1];
    if (derived) return derived.toUpperCase();
  }
  return symbol.toUpperCase();
}

export function extractFirstZipEntry(zip: Buffer): Buffer {
  const centralSignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const centralOffset = zip.indexOf(centralSignature);
  if (centralOffset < 0) throw new Error("instrument_master_zip_invalid");

  const compressionMethod = zip.readUInt16LE(centralOffset + 10);
  const compressedSize = zip.readUInt32LE(centralOffset + 20);
  const localOffset = zip.readUInt32LE(centralOffset + 42);
  if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error("instrument_master_zip_invalid");
  }

  const fileNameLength = zip.readUInt16LE(localOffset + 26);
  const extraLength = zip.readUInt16LE(localOffset + 28);
  const dataOffset = localOffset + 30 + fileNameLength + extraLength;
  const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) return compressed;
  if (compressionMethod === 8) return inflateRawSync(compressed);
  throw new Error(`instrument_master_zip_compression_unsupported:${compressionMethod}`);
}

export function parseInstrumentMasterCsv(
  csv: string,
  brokerCode = "ZEBU",
): BrokerInstrumentMasterRow[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const rows: BrokerInstrumentMasterRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]);
    const raw: Record<string, unknown> = {};
    headers.forEach((header, headerIndex) => {
      if (header) raw[header] = values[headerIndex] ?? "";
    });

    const exchange = String(raw.Exchange ?? "").trim().toUpperCase();
    const brokerToken = String(raw.Token ?? "").trim();
    const sourceUnderlying = String(raw.Symbol ?? "").trim().toUpperCase();
    const tradingSymbol = String(raw.TradingSymbol ?? "").trim().toUpperCase();
    const sourceInstrumentType = String(raw.Instrument ?? "");
    const instrumentType = normalizeInstrumentType(sourceInstrumentType);
    const underlying = normalizeUnderlying(sourceUnderlying, tradingSymbol, instrumentType);
    const rawOptionType = String(raw.OptionType ?? "").trim().toUpperCase();
    const optionType = rawOptionType === "CE" || rawOptionType === "PE" ? rawOptionType : null;
    const lotSize = Number(raw.LotSize ?? 0);
    const tickSize = Number(raw.TickSize ?? 0);
    const strike = optionType ? Number(raw.StrikePrice ?? 0) : null;
    const expiry = normalizeExpiry(String(raw.Expiry ?? ""));

    if (
      !exchange ||
      !brokerToken ||
      !underlying ||
      !tradingSymbol ||
      !Number.isFinite(lotSize) ||
      lotSize <= 0 ||
      !Number.isFinite(tickSize) ||
      tickSize <= 0
    ) {
      continue;
    }

    rows.push({
      brokerCode,
      exchange,
      brokerToken,
      underlying,
      tradingSymbol,
      instrumentType,
      optionType,
      strike: strike !== null && Number.isFinite(strike) ? strike : null,
      expiry,
      lotSize,
      tickSize,
      raw,
    });
  }

  return rows;
}

export class BrokerInstrumentService {
  static syncInFlight: Promise<InstrumentSyncResult> | null = null;

  async ensureSchema() {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS broker_instruments (
        id BIGSERIAL PRIMARY KEY,
        broker_code VARCHAR(30) NOT NULL,
        exchange VARCHAR(20) NOT NULL,
        broker_token VARCHAR(80) NOT NULL,
        underlying VARCHAR(80) NOT NULL,
        trading_symbol VARCHAR(120) NOT NULL,
        instrument_type VARCHAR(30) NOT NULL,
        option_type VARCHAR(4),
        strike NUMERIC(18, 6),
        expiry DATE,
        lot_size NUMERIC(20, 6) NOT NULL,
        tick_size NUMERIC(18, 8) NOT NULL,
        raw JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_seen_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(broker_code, exchange, trading_symbol)
      );
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_broker_instruments_option_lookup
      ON broker_instruments(
        broker_code, exchange, underlying, instrument_type, option_type, expiry, is_active
      );
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_broker_instruments_last_seen_at
      ON broker_instruments(last_seen_at DESC);
    `);
  }

  async needsSync(): Promise<boolean> {
    const rows = await AppDataSource.query(
      `SELECT MAX(last_seen_at) AS "lastSeenAt" FROM broker_instruments WHERE broker_code = 'ZEBU'`,
    );
    const lastSeenAt = rows[0]?.lastSeenAt ? new Date(rows[0].lastSeenAt).getTime() : 0;
    return !lastSeenAt || Date.now() - lastSeenAt >= SYNC_STALE_MS;
  }

  async syncIfStale() {
    if (!(await this.needsSync())) return { skipped: true, reason: "instrument_master_fresh" };
    return this.sync();
  }

  async sync(segments = DEFAULT_SEGMENTS): Promise<InstrumentSyncResult> {
    const normalizedSegments = normalizeSyncSegments(segments);
    if (BrokerInstrumentService.syncInFlight) return BrokerInstrumentService.syncInFlight;
    BrokerInstrumentService.syncInFlight = this.performSync(normalizedSegments).finally(() => {
      BrokerInstrumentService.syncInFlight = null;
    });
    return BrokerInstrumentService.syncInFlight;
  }

  private async downloadSegment(segment: string): Promise<BrokerInstrumentMasterRow[]> {
    const baseUrl = String(process.env.ZEBU_INSTRUMENT_MASTER_BASE_URL ?? DEFAULT_MASTER_BASE_URL)
      .replace(/\/+$/, "");
    const controller = new AbortController();
    const timeoutMs = Number(process.env.ZEBU_INSTRUMENT_SYNC_TIMEOUT_MS ?? 60000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/${segment}_symbols.txt.zip`, {
        headers: { accept: "application/zip" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`instrument_master_download_failed:${segment}:${response.status}`);
      }
      const zip = Buffer.from(await response.arrayBuffer());
      const rows = parseInstrumentMasterCsv(extractFirstZipEntry(zip).toString("utf8"));
      if (!rows.length) throw new Error(`instrument_master_empty:${segment}`);
      return rows;
    } finally {
      clearTimeout(timer);
    }
  }

  private async performSync(segments: string[]): Promise<InstrumentSyncResult> {
    const normalizedSegments = normalizeSyncSegments(segments);
    const downloaded = await Promise.all(
      normalizedSegments.map(async (segment) => ({ segment, rows: await this.downloadSegment(segment) })),
    );
    const syncAt = new Date();
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of downloaded) {
        for (let offset = 0; offset < item.rows.length; offset += 250) {
          const batch = item.rows.slice(offset, offset + 250);
          const params: unknown[] = [];
          const tuples = batch.map((row) => {
            const start = params.length;
            params.push(
              row.brokerCode,
              row.exchange,
              row.brokerToken,
              row.underlying,
              row.tradingSymbol,
              row.instrumentType,
              row.optionType,
              row.strike,
              row.expiry,
              row.lotSize,
              row.tickSize,
              JSON.stringify(row.raw),
              syncAt,
            );
            return `(${Array.from({ length: 13 }, (_, index) => `$${start + index + 1}`).join(",")})`;
          });
          await queryRunner.query(
            `
            INSERT INTO broker_instruments(
              broker_code, exchange, broker_token, underlying, trading_symbol,
              instrument_type, option_type, strike, expiry, lot_size, tick_size,
              raw, last_seen_at
            )
            VALUES ${tuples.join(",")}
            ON CONFLICT(broker_code, exchange, trading_symbol)
            DO UPDATE SET
              broker_token = EXCLUDED.broker_token,
              underlying = EXCLUDED.underlying,
              instrument_type = EXCLUDED.instrument_type,
              option_type = EXCLUDED.option_type,
              strike = EXCLUDED.strike,
              expiry = EXCLUDED.expiry,
              lot_size = EXCLUDED.lot_size,
              tick_size = EXCLUDED.tick_size,
              raw = EXCLUDED.raw,
              is_active = true,
              last_seen_at = EXCLUDED.last_seen_at,
              updated_at = now()
            `,
            params,
          );
        }
        await queryRunner.query(
          `
          UPDATE broker_instruments
          SET is_active = false, updated_at = now()
          WHERE broker_code = 'ZEBU' AND exchange = $1 AND last_seen_at < $2
          `,
          [item.segment, syncAt],
        );
      }
      await queryRunner.commitTransaction();
      return {
        skipped: false,
        syncedAt: syncAt.toISOString(),
        segments: downloaded.map((item) => ({ exchange: item.segment, count: item.rows.length })),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findOptionContracts(args: {
    exchange: string;
    underlying: string;
    optionType: "CE" | "PE";
    minExpiry: string;
  }): Promise<BrokerInstrument[]> {
    return AppDataSource.getRepository(BrokerInstrument)
      .createQueryBuilder("instrument")
      .where("instrument.brokerCode = :brokerCode", { brokerCode: "ZEBU" })
      .andWhere("instrument.exchange = :exchange", { exchange: args.exchange })
      .andWhere("instrument.underlying = :underlying", { underlying: args.underlying })
      .andWhere("instrument.instrumentType = :instrumentType", { instrumentType: "OPTIONS" })
      .andWhere("instrument.optionType = :optionType", { optionType: args.optionType })
      .andWhere("instrument.expiry >= :minExpiry", { minExpiry: args.minExpiry })
      .andWhere("instrument.isActive = true")
      .orderBy("instrument.expiry", "ASC")
      .addOrderBy("instrument.strike", "ASC")
      .getMany();
  }
}

export type InstrumentSyncResult = {
  skipped: boolean;
  reason?: string;
  syncedAt?: string;
  segments?: Array<{ exchange: string; count: number }>;
};
