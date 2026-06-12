import crypto from "crypto";

type RazorpayXContactResponse = {
  id: string;
  name: string;
  email?: string | null;
  contact?: string | null;
  type: string;
  reference_id?: string | null;
  active?: boolean;
  notes?: Record<string, any>;
};

type RazorpayXFundAccountResponse = {
  id: string;
  contact_id: string;
  account_type: string;
  active?: boolean;
  bank_account?: {
    name: string;
    ifsc: string;
    account_number: string;
    bank_name?: string | null;
  };
};

type RazorpayXPayoutResponse = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  mode?: string | null;
  purpose?: string | null;
  fund_account_id?: string | null;
  reference_id?: string | null;
  narration?: string | null;
  notes?: Record<string, any>;
  fees?: number | null;
  tax?: number | null;
  failure_reason?: string | null;
  utr?: string | null;
};

export class RazorpayXService {
  private readonly baseUrl = "https://api.razorpay.com";

  private buildAuthHeader(): string {
    const oauthToken = process.env.RAZORPAYX_OAUTH_TOKEN?.trim() || "";
    if (oauthToken) {
      return `Bearer ${oauthToken}`;
    }

    const keyId = process.env.RAZORPAYX_KEY_ID?.trim() || "";
    const keySecret = process.env.RAZORPAYX_KEY_SECRET?.trim() || "";

    if (!keyId || !keySecret) {
      throw new Error("razorpayx_not_configured");
    }

    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.buildAuthHeader(),
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(extraHeaders || {}),
      },
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        data?.error?.description ||
        data?.error?.reason ||
        data?.error?.message ||
        data?.message ||
        "razorpayx_request_failed";
      throw new Error(message);
    }

    return data as T;
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string, webhookSecret: string) {
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    return expected === signature;
  }

  async createContact(args: {
    name: string;
    email?: string | null;
    contact?: string | null;
    type?: string;
    referenceId?: string | null;
    notes?: Record<string, any>;
  }): Promise<RazorpayXContactResponse> {
    return this.request<RazorpayXContactResponse>("/v1/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: args.name,
        email: args.email ?? undefined,
        contact: args.contact ?? undefined,
        type: args.type ?? "customer",
        reference_id: args.referenceId ?? undefined,
        notes: args.notes ?? {},
      }),
    });
  }

  async createFundAccount(args: {
    contactId: string;
    accountHolderName: string;
    ifscCode: string;
    accountNumber: string;
  }): Promise<RazorpayXFundAccountResponse> {
    return this.request<RazorpayXFundAccountResponse>("/v1/fund_accounts", {
      method: "POST",
      body: JSON.stringify({
        contact_id: args.contactId,
        account_type: "bank_account",
        bank_account: {
          name: args.accountHolderName,
          ifsc: args.ifscCode,
          account_number: args.accountNumber,
        },
      }),
    });
  }

  async createPayout(args: {
    sourceAccountNumber: string;
    fundAccountId: string;
    amountPaise: number;
    referenceId: string;
    narration?: string;
    notes?: Record<string, any>;
    idempotencyKey: string;
  }): Promise<RazorpayXPayoutResponse> {
    return this.request<RazorpayXPayoutResponse>(
      "/v1/payouts",
      {
        method: "POST",
        body: JSON.stringify({
          account_number: args.sourceAccountNumber,
          fund_account_id: args.fundAccountId,
          amount: args.amountPaise,
          currency: "INR",
          mode: "IMPS",
          purpose: "payout",
          queue_if_low_balance: true,
          reference_id: args.referenceId,
          narration: args.narration ?? undefined,
          notes: args.notes ?? {},
        }),
      },
      {
        "X-Payout-Idempotency": args.idempotencyKey,
      }
    );
  }
}
