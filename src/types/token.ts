import crypto from "crypto";

const VERIFICATION_TOKEN_BYTES = 32;

export function generateRawToken(): string {
  return crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getVerificationExpiry(): Date {
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // 24h expiry
  return expires;
}
export function generateVerificationToken(): {
  rawToken: string;
  hashedToken: string;
  expiresAt: Date;
} {
  const rawToken = generateRawToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = getVerificationExpiry();

  return { rawToken, hashedToken, expiresAt };
}