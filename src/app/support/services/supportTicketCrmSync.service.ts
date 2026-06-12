export type CrmSupportTicketPayload = {
  externalTradingTicketId: string;
  platformUserId: string;
  email: string;
  name?: string | null;
  subject: string;
  message: string;
  createdAt: string;
  organizationId?: string | null;
};

export type CrmSupportMessagePayload = {
  externalTradingMessageId: string;
  platformUserId: string;
  body: string;
  createdAt: string;
};

export class SupportTicketCrmSyncService {
  private getBaseUrl() {
    return String(process.env.CRM_BASE_URL || "http://127.0.0.1:5000")
      .trim()
      .replace(/\/$/, "");
  }

  private getApiSecret() {
    return String(
      process.env.CRM_INTEGRATION_SECRET ||
        process.env.CRM_CONVERSION_SECRET ||
        process.env.CRM_API_SECRET ||
        "my_secret"
    ).trim();
  }

  private async request(path: string, body: Record<string, unknown>) {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": this.getApiSecret(),
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        `CRM support sync failed (${response.status}): ${text || "Unknown error"}`
      );
    }

    return json;
  }

  async createTicket(payload: CrmSupportTicketPayload) {
    return this.request("/api/integrations/trading/support/tickets", payload);
  }

  async addMessage(
    externalTradingTicketId: string,
    payload: CrmSupportMessagePayload
  ) {
    return this.request(
      `/api/integrations/trading/support/tickets/${encodeURIComponent(
        externalTradingTicketId
      )}/messages`,
      payload
    );
  }
}
