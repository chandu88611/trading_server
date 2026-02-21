import { mailTransporter } from "./mail";

export interface SendVerificationEmailParams {
  email: string;
  token: string;
}

export interface SendCopyTradingRequestEmailParams {
  masterEmail: string;
  masterName: string;
  followerName: string;
  followerEmail: string;
  requestId: number;
}

export async function sendVerificationEmail({
  email,
  token,
}: SendVerificationEmailParams): Promise<void> {
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
