export class CrmLeadSyncService {
  async convertLeadByEmail(email?: string | null): Promise<void> {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return;

    const baseUrl = (process.env.CRM_BASE_URL || "").trim();
    const apiSecret =
      (process.env.CRM_CONVERSION_SECRET ||
        process.env.CRM_API_SECRET ||
        "").trim();

    if (!baseUrl || !apiSecret) {
      return;
    }

    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/customer/convert-by-email`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": apiSecret,
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.warn(
          "[CRM_SYNC] lead conversion request failed:",
          response.status,
          body
        );
      }
    } catch (error: any) {
      console.warn(
        "[CRM_SYNC] lead conversion request error:",
        error?.message || error
      );
    }
  }
}
