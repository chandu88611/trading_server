import { Readable } from "stream";

const inMemoryApps = new Map<string, any>();

function headersToObject(headers?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[String(key).toLowerCase()] = String(value);
    return out;
  }
  for (const [key, value] of Object.entries(headers as Record<string, string>)) {
    out[key.toLowerCase()] = String(value);
  }
  return out;
}

export async function startInMemoryApp(app: any, name = "route-test") {
  const origin = `http://${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.local`;
  inMemoryApps.set(origin, app);
  return {
    baseUrl: origin,
    async close() {
      inMemoryApps.delete(origin);
    },
  };
}

async function dispatchInMemory(app: any, path: string, init?: RequestInit) {
  const bodyText = init?.body ? String(init.body) : "";
  const req: any = Readable.from(bodyText ? [bodyText] : []);
  req.method = init?.method ?? "GET";
  req.url = path;
  req.originalUrl = path;
  req.headers = headersToObject(init?.headers);
  if (bodyText && !req.headers["content-length"]) {
    req.headers["content-length"] = String(Buffer.byteLength(bodyText));
  }
  req.socket = { encrypted: false, remoteAddress: "127.0.0.1" };
  req.connection = req.socket;

  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const res: any = {
      statusCode: 200,
      headersSent: false,
      locals: {},
      _headers: {} as Record<string, string>,
      setHeader(name: string, value: unknown) {
        this._headers[name.toLowerCase()] = String(value);
      },
      getHeader(name: string) {
        return this._headers[name.toLowerCase()];
      },
      removeHeader(name: string) {
        delete this._headers[name.toLowerCase()];
      },
      writeHead(statusCode: number, headers?: Record<string, unknown>) {
        this.statusCode = statusCode;
        Object.entries(headers ?? {}).forEach(([key, value]) => this.setHeader(key, value));
        this.headersSent = true;
        return this;
      },
      write(chunk: any) {
        if (chunk !== undefined) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        return true;
      },
      end(chunk?: any) {
        if (chunk !== undefined) this.write(chunk);
        this.headersSent = true;
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: this.statusCode, body: text ? JSON.parse(text) : null });
      },
    };
    res.req = req;
    req.res = res;
    app.handle(req, res, reject);
  });
}

export async function requestJson(url: string, init?: RequestInit) {
  const parsed = new URL(url);
  const app = inMemoryApps.get(parsed.origin);
  if (app) return dispatchInMemory(app, `${parsed.pathname}${parsed.search}`, init);

  const response = await fetch(url, init);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
