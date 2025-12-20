import crypto from "crypto";

const TOKEN_BYTES = 32;

export function generateEmailVerificationToken(): {
  raw: string;
  hash: string;
} {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");

  return { raw, hash };
}
