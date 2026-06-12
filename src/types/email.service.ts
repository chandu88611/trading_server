import { mailTransporter, isMailEnabled } from "./mail";

export interface SendVerificationEmailParams {
  email: string;
  token: string;
}

/**
 * Send a test email to verify SMTP configuration end-to-end.
 * Returns a structured result instead of throwing so the admin UI can show status.
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; enabled: boolean; message: string }> {
  if (!isMailEnabled) {
    return { ok: false, enabled: false, message: "SMTP is not configured (set SMTP_HOST/PORT/USER/PASS)." };
  }
  try {
    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: "TradeBro — SMTP test email",
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#10b981;margin:0 0 8px">SMTP is working ✅</h2>
          <p>This is a test email from your TradeBro server.</p>
          <p style="color:#64748b;font-size:12px">Sent at ${new Date().toISOString()}</p>
        </div>`,
    });
    return { ok: true, enabled: true, message: `Test email sent to ${to}.` };
  } catch (err: any) {
    return { ok: false, enabled: true, message: `SMTP send failed: ${err?.message ?? String(err)}` };
  }
}

export interface SendCopyTradingRequestEmailParams {
  masterEmail: string;
  masterName: string;
  followerName: string;
  followerEmail: string;
  requestId: number;
}

export interface SendSupportTicketReplyEmailParams {
  email: string;
  ticketSubject: string;
  replyBody: string;
  executiveName?: string | null;
}

export async function sendVerificationEmail({
  email,
  token,
}: SendVerificationEmailParams): Promise<void> {
  if (!isMailEnabled) return;
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) {
    throw new Error("APP_BASE_URL not configured");
  }

  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Verify your email address",
    html: `
      <p>Welcome 👋</p>
      <p>Please verify your email by clicking the link below:</p>
      <p>
        <a href="${verifyUrl}">
          Verify Email
        </a>
      </p>
      <p>This link is valid for 24 hours.</p>
    `,
  });
}

export async function sendCopyTradingRequestEmail({
  masterEmail,
  masterName,
  followerName,
  followerEmail,
  requestId,
}: SendCopyTradingRequestEmailParams): Promise<void> {
  if (!isMailEnabled) return;
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) {
    throw new Error("APP_BASE_URL not configured");
  }

  const acceptUrl = `${baseUrl}/copy-trading/accept?requestId=${requestId}`;
  const rejectUrl = `${baseUrl}/copy-trading/reject?requestId=${requestId}`;

  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM,
    to: followerEmail,
    subject: "Copy Trading Invitation - Action Required",
    html: `
      <h2>You've Been Invited to Copy Trade!</h2>
      <p>Hello ${followerName},</p>
      <p>You have received an invitation to copy the trading strategies of an experienced trader.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Invitation Details:</h3>
        <p><strong>Master Trader:</strong> ${masterName}</p>
        <p><strong>Master Email:</strong> ${masterEmail}</p>
        <p><strong>Request ID:</strong> #${requestId}</p>
      </div>

      <p>By accepting this invitation, your trades will automatically mirror the master trader's strategies. You can start copying their proven trading methods.</p>
      
      <div style="margin: 30px 0;">
        <a href="${acceptUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          Accept Invitation
        </a>
        <a href="${rejectUrl}" style="background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Decline
        </a>
      </div>

      <p style="color: #666; font-size: 12px;">
        If you did not expect this invitation or are not interested, you can safely decline or ignore this email.
      </p>
    `,
  });
}

export async function sendSupportTicketReplyEmail({
  email,
  ticketSubject,
  replyBody,
  executiveName,
}: SendSupportTicketReplyEmailParams): Promise<void> {
  if (!isMailEnabled) return;
  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Support update: ${ticketSubject}`,
    html: `
      <p>Hello,</p>
      <p>You have a new reply on your support ticket <strong>${ticketSubject}</strong>.</p>
      ${
        executiveName
          ? `<p><strong>Support executive:</strong> ${executiveName}</p>`
          : ""
      }
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;">
        ${replyBody.replace(/\n/g, "<br />")}
      </div>
      <p>Please log in to your Tradebro account if you want to continue the conversation.</p>
    `,
  });
}

export interface TradeNotificationParams {
  userEmail: string;
  userName?: string | null;
  event: "executed" | "closed" | "failed";
  symbol: string;
  exchange: string;
  side: string; // BUY / SELL
  quantity: number;
  price?: number | null;
  brokerOrderId?: string | null;
  errorMessage?: string | null;
  pnl?: number | null;
  broker?: string;
  tradeSignalId?: number;
}

export async function sendTradeNotificationEmail(params: TradeNotificationParams): Promise<void> {
  if (!isMailEnabled) return;

  const {
    userEmail, event, symbol, exchange, side,
    quantity, price, brokerOrderId, errorMessage, pnl, broker, tradeSignalId,
  } = params;

  const subjectMap = {
    executed: `✅ Trade Executed: ${side} ${quantity} ${symbol}`,
    closed:   `🔒 Trade Closed: ${symbol}`,
    failed:   `❌ Trade Failed: ${side} ${quantity} ${symbol}`,
  };

  const colorMap = { executed: "#10b981", closed: "#6366f1", failed: "#ef4444" };
  const color = colorMap[event];

  const eventLabel = { executed: "Order Placed", closed: "Position Closed", failed: "Order Failed" }[event];

  const rows = [
    ["Symbol", symbol],
    ["Exchange", exchange],
    ["Side", side],
    ["Quantity", String(quantity)],
    price != null ? ["Price", `₹${Number(price).toLocaleString("en-IN")}`] : null,
    brokerOrderId ? ["Broker Order ID", brokerOrderId] : null,
    broker ? ["Broker", broker] : null,
    pnl != null ? ["P&L", `₹${Number(pnl).toFixed(2)}`] : null,
    errorMessage ? ["Error", errorMessage] : null,
    tradeSignalId ? ["Signal ID", String(tradeSignalId)] : null,
  ]
    .filter((r): r is [string, string] => r !== null)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;color:#94a3b8;white-space:nowrap">${label}</td><td style="padding:6px 12px;color:#f1f5f9;font-weight:600">${value}</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#f1f5f9;padding:24px;border-radius:12px;max-width:520px;margin:auto">
      <div style="border-left:4px solid ${color};padding-left:16px;margin-bottom:20px">
        <h2 style="margin:0 0 4px;color:${color}">${eventLabel}</h2>
        <p style="margin:0;color:#94a3b8;font-size:13px">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden">
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#475569;font-size:12px;margin-top:16px">
        This is an automated notification from TradeBro. Do not reply to this email.
      </p>
    </div>
  `;

  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM,
    to: userEmail,
    subject: subjectMap[event],
    html,
  });
}
