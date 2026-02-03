"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
const mail_1 = require("./mail");
async function sendVerificationEmail({ email, token, }) {
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
        throw new Error("APP_BASE_URL not configured");
    }
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    await mail_1.mailTransporter.sendMail({
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
