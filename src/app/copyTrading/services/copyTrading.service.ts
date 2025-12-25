import { QueryRunner } from "typeorm";
import { CopyTradingDBService } from "./copyTrading.db";
import { CopyEventType, CopyTradeSide } from "../../../entity/CopyMasterEvent";

function normalizeAction(action?: string) {
  return String(action || "")
    .trim()
    .toUpperCase();
}

function mapToCopyEvent(action?: string): {
  eventType: CopyEventType;
  side: CopyTradeSide | null;
} {
  const a = normalizeAction(action);

  if (a === "BUY" || a === "LONG")
    return { eventType: CopyEventType.OPEN, side: CopyTradeSide.BUY };
  if (a === "SELL" || a === "SHORT")
    return { eventType: CopyEventType.OPEN, side: CopyTradeSide.SELL };

  if (a.includes("CLOSE"))
    return { eventType: CopyEventType.CLOSE, side: null };
  if (a.includes("MODIFY"))
    return { eventType: CopyEventType.MODIFY, side: null };
  if (a.includes("PARTIAL"))
    return { eventType: CopyEventType.PARTIAL_CLOSE, side: null };

  return { eventType: CopyEventType.OPEN, side: null };
}

export class CopyTradingService {
  private dbService: CopyTradingDBService;

  constructor() {
    this.dbService = new CopyTradingDBService();
  }

  async fanoutFromMasterSignal(
    args: {
      userId: number;
      brokerJobId: number;
      alertSnapshotId: number;
      action: string;
      symbol: string;
      exchange?: string;
      price?: number | string | null;
      signalTime: Date;
    },
    queryRunner?: QueryRunner
  ) {
    const master = await this.dbService.getOrCreateDefaultMasterForUser(
      args.userId,
      queryRunner
    );

    const { eventType, side } = mapToCopyEvent(args.action);

    const masterOrderRef = `job:${args.brokerJobId}:alert:${args.alertSnapshotId}`;

    const masterEvent = await this.dbService.createMasterEvent(
      {
        masterId: Number(master.id),
        eventType,
        symbol: args.symbol,
        side,
        price: args.price ?? null,
        signalTime: args.signalTime,
        masterOrderRef,
        payload: {
          source: "alert_snapshot",
          brokerJobId: args.brokerJobId,
          alertSnapshotId: args.alertSnapshotId,
          action: args.action,
          symbol: args.symbol,
          exchange: args.exchange,
          price: args.price ?? null,
          signalTime: args.signalTime,
        },
      },
      queryRunner
    );

    const follows = await this.dbService.getEligibleFollows(
      Number(master.id),
      args.symbol,
      queryRunner
    );

    const payloadBase = {
      master: { id: master.id, ownerUserId: master.ownerUserId },
      masterEvent: {
        id: masterEvent.id,
        type: masterEvent.eventType,
        symbol: masterEvent.symbol,
        side: masterEvent.side,
        price: masterEvent.price,
        masterOrderRef: masterEvent.masterOrderRef,
        signalTime: masterEvent.signalTime,
      },
    };

    const res = await this.dbService.enqueueTasks(
      { masterEventId: Number(masterEvent.id), follows, payloadBase },
      queryRunner
    );

    return {
      masterId: master.id,
      masterEventId: masterEvent.id,
      queued: res.queued,
    };
  }
}
