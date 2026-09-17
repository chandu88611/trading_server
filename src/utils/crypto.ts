import crypto from "node:crypto";

const PREFIX = "enc:v1:";
let warnedLegacyCredential = false;
const AAD = Buffer.from("tradebro:broker-credential:v1");
function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  const key = /^[a-fA-F0-9]{64}$/.test(raw) ? Buffer.from(raw,"hex")
    : /^[A-Za-z0-9+/]{43}=$/.test(raw) ? Buffer.from(raw,"base64")
    : Buffer.from(raw,"utf8");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY_must_be_32_bytes_raw_hex_or_base64");
  return key;
}
export function encrypt(value: string): string {
  if (!value) return value;
  if (value.startsWith(PREFIX)) { decrypt(value); return value; }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  cipher.setAAD(AAD);
  const data = Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return PREFIX+[iv,cipher.getAuthTag(),data].map(x=>x.toString("base64")).join(":");
}
export function decrypt(value: string): string {
  // Transitional reads preserve existing connections until migration is run.
  if (!value) return value;
  if (!value.startsWith("enc:")) {
    if (!warnedLegacyCredential) {
      console.warn("[CREDENTIALS] Legacy plaintext credential read; migrate stored credentials to AES-256-GCM.");
      warnedLegacyCredential = true;
    }
    return value;
  }
  // An explicit encrypted envelope is not plaintext. Never send corrupted
  // ciphertext to a broker as a credential, or hide an incorrect encryption key.
  if (!value.startsWith(PREFIX)) throw new Error("unsupported_credential_envelope");
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("invalid_credential_envelope");
  const [iv,tag,data] = parts.map(x=>Buffer.from(x,"base64"));
  if (iv.length !== 12 || tag.length !== 16) throw new Error("invalid_credential_envelope");
  const cipher = crypto.createDecipheriv("aes-256-gcm",encryptionKey(),iv);
  cipher.setAAD(AAD); cipher.setAuthTag(tag);
  try {
    return Buffer.concat([cipher.update(data),cipher.final()]).toString("utf8");
  } catch {
    console.warn("[CREDENTIALS] Encrypted credential authentication failed; check the encryption key or restore the credential.");
    throw new Error("credential_authentication_failed");
  }
}
function secretField(key: string) {
  return /(?:apikey|apisecret|appkey|vendorcode|vc|accessToken|refreshToken|clientsecret|password|secret|susertoken|jkey|authToken|credentialsEncrypted|mt5PollKey|webhookToken|pollKey)$/i.test(key.replace(/[_-]/g,""));
}
function mapSecrets<T>(value: T, transform: (s:string)=>string, redact=false): T {
  if (value == null || typeof value !== "object" || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(x=>mapSecrets(x,transform,redact)) as T;
  const result: Record<string,unknown> = {};
  for (const [key,item] of Object.entries(value)) {
    if (secretField(key)) {
      if (!redact) result[key] = typeof item === "string" ? transform(item) : item;
    } else result[key] = mapSecrets(item,transform,redact);
  }
  return result as T;
}
export const encryptCredentials = <T>(value:T):T => mapSecrets(value,encrypt);
export const decryptCredentials = <T>(value:T):T => mapSecrets(value,decrypt);
export const sanitizeCredentials = <T>(value:T):T => mapSecrets(value,s=>s,true);

/** Preserve credentials omitted by the sanitized settings form, including nested broker settings. */
export function mergeAccountMeta(current: any, patch: any): any {
  if (patch === undefined) return current;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const merged = {...(current ?? {})};
  for (const [key,value] of Object.entries(patch)) merged[key] = value && typeof value === "object" && !Array.isArray(value) ? mergeAccountMeta(merged[key],value) : value;
  return merged;
}
