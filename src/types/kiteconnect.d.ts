declare module "kiteconnect" {
  export class KiteConnect {
    constructor(opts: { api_key: string });
    generateSession(request_token: string, api_secret: string): Promise<any>;
    getMargins(): Promise<any>;
  }
  export = { KiteConnect };
}
