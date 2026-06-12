import { Request, Response } from "express";
import { Mt5ListenerServices } from "./mt5Listener.services";

export class Mt5ListenerController {
  constructor(
    private readonly service: Mt5ListenerServices
  ) {}

  private parseJson(raw: string): any | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private normalizeAckBody(body: unknown): Record<string, unknown> {
    if (body == null) return {};

    if (Buffer.isBuffer(body)) {
      const parsed = this.parseJson(body.toString("utf8").replace(/\0/g, "").trim());
      return parsed && typeof parsed === "object" ? parsed : {};
    }

    if (typeof body === "string") {
      const parsed = this.parseJson(body.replace(/\0/g, "").trim());
      return parsed && typeof parsed === "object" ? parsed : {};
    }

    if (typeof body !== "object") return {};

    const payload = body as Record<string, unknown>;
    if (
      "ackId" in payload ||
      "status" in payload ||
      "ticket" in payload ||
      "order_id" in payload ||
      "orderId" in payload
    ) {
      return payload;
    }

    const keys = Object.keys(payload);
    if (!keys.length) return {};

    if (keys.length === 1) {
      const singleKeyRaw = keys[0].replace(/\0/g, "").trim();
      const parsedSingleKey = this.parseJson(singleKeyRaw);
      if (parsedSingleKey && typeof parsedSingleKey === "object") {
        return parsedSingleKey;
      }
    }

    // MT5 can post JSON with "application/x-www-form-urlencoded"; "&" inside message
    // splits the JSON into multiple keys. Rebuild and parse the raw payload shape.
    const rebuiltFromKeys = keys.join("&").replace(/\0/g, "").trim();
    const parsedFromKeys = this.parseJson(rebuiltFromKeys);
    if (parsedFromKeys && typeof parsedFromKeys === "object") {
      return parsedFromKeys;
    }

    return payload;
  }

  private normalizeStateBody(body: unknown): Record<string, unknown> {
    if (body == null) return {};

    if (Buffer.isBuffer(body)) {
      const parsed = this.parseJson(body.toString("utf8").replace(/\0/g, "").trim());
      return parsed && typeof parsed === "object" ? parsed : {};
    }

    if (typeof body === "string") {
      const parsed = this.parseJson(body.replace(/\0/g, "").trim());
      return parsed && typeof parsed === "object" ? parsed : {};
    }

    if (typeof body !== "object") return {};

    const payload = body as Record<string, unknown>;
    const keys = Object.keys(payload);
    if (keys.length === 1) {
      const singleKeyRaw = keys[0].replace(/\0/g, "").trim();
      const parsedSingleKey = this.parseJson(singleKeyRaw);
      if (parsedSingleKey && typeof parsedSingleKey === "object") {
        return parsedSingleKey;
      }
    }

    if (keys.length > 1) {
      const rebuiltFromKeys = keys.join("&").replace(/\0/g, "").trim();
      const parsedFromKeys = this.parseJson(rebuiltFromKeys);
      if (parsedFromKeys && typeof parsedFromKeys === "object") {
        return parsedFromKeys;
      }
    }

    return payload;
  }

  async listenSignal(req: Request, res: Response) {
    try {
      const brokerAccountId = String(req.query.userId || "");
      if (!brokerAccountId) return res.json({});
      const signal =
        await this.service.getSignalForEA(brokerAccountId);        
      return res.json(signal);
    } catch (err) {
      console.error("listenSignal error:", err);
      return res.json({});
    }
  }

  async ackListenSignal(req: Request, res: Response) {
    try {
      const body = this.normalizeAckBody(req.body);
      await this.service.handleAck(body);
      return res.json({ ok: true });
    } catch (err) {
      console.error("ack error:", err);
      return res.json({ ok: false });
    }
  }

  async stateListenSignal(_: Request, res: Response) {
    const brokerAccountId = String((_.query.userId ?? _.query.brokerAccountId ?? "")).trim();
    const payload = this.normalizeStateBody(_.body);
    const result = await this.service.handleState(brokerAccountId, payload);
    return res.json(result);
  }
}
