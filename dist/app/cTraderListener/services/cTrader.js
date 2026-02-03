"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTraderService = void 0;
class CTraderService {
    constructor(opts) {
        this.baseUrl = (opts?.baseUrl ?? process.env.CTRADER_GATEWAY_URL ?? "http://69.62.126.107:8089").replace(/\/+$/, "");
        this.timeoutMs = opts?.timeoutMs ?? Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000);
    }
    async checkConnection() {
        const url = `${this.baseUrl}/health`;
        const started = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const res = await fetch(url, {
                method: "GET",
                headers: { "accept": "application/json" },
                signal: controller.signal,
            });
            const latencyMs = Date.now() - started;
            let payload = null;
            const contentType = res.headers.get("content-type") ?? "";
            try {
                if (contentType.includes("application/json"))
                    payload = await res.json();
                else
                    payload = await res.text();
            }
            catch {
            }
            const ok = res.ok &&
                (payload == null ||
                    payload === "ok" ||
                    payload?.ok === true ||
                    payload?.status === "ok" ||
                    payload?.healthy === true);
            return {
                ok,
                url,
                status: res.status,
                latencyMs,
                payload,
                ...(ok ? {} : { error: `unhealthy_response status=${res.status}` }),
            };
        }
        catch (err) {
            const latencyMs = Date.now() - started;
            const isAbort = err?.name === "AbortError" ||
                String(err?.message || "").toLowerCase().includes("aborted");
            return {
                ok: false,
                url,
                latencyMs,
                error: isAbort ? `timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)),
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.CTraderService = CTraderService;
