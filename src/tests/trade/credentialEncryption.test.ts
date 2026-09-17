import test from "node:test";
import assert from "node:assert/strict";
import {encrypt,decrypt,encryptCredentials,sanitizeCredentials,mergeAccountMeta} from "../../utils/crypto";
import {CoinDCXDB} from "../../app/coindcx/services/coindcx.db";
import {CoinDCXService} from "../../app/coindcx/services/coindcx.service";
test("legacy plaintext reads work without a key and warnings never include credentials",t=>{
 const warning=t.mock.method(console,"warn",()=>{});
 delete process.env.ENCRYPTION_KEY;
 assert.equal(decrypt("old-api-secret"),"old-api-secret");
 assert.equal(decrypt("unversioned:legacy:token"),"unversioned:legacy:token");
 assert.equal(decrypt(""),"");
 assert.equal(warning.mock.calls.length,1);
 assert.ok(!JSON.stringify(warning.mock.calls).includes("old-api-secret"));
});
test("encryption accepts 32-byte raw, hex and base64 keys and rejects invalid lengths",()=>{
 for(const key of ["ab".repeat(32),Buffer.alloc(32,7).toString("base64"),"a".repeat(32)]){
  process.env.ENCRYPTION_KEY=key;assert.equal(decrypt(encrypt("credential")),"credential");
 }
 for(const key of ["short","a".repeat(31),"a".repeat(33),"é".repeat(32)]){
  process.env.ENCRYPTION_KEY=key;assert.throws(()=>encrypt("credential"));
 }
});
test("AES-GCM credentials reject tampering and wrong keys and use unique nonces",()=>{
 process.env.ENCRYPTION_KEY="ab".repeat(32);
 const a=encrypt("secret");assert.notEqual(a,encrypt("secret"));assert.equal(decrypt(a),"secret");assert.equal(encrypt(a),a);
 const parts=a.split(":");parts[3]=Buffer.alloc(16).toString("base64");assert.throws(()=>decrypt(parts.join(":")));
 process.env.ENCRYPTION_KEY="cd".repeat(32);assert.throws(()=>decrypt(a));
 delete process.env.ENCRYPTION_KEY;assert.throws(()=>encrypt("secret"));assert.equal(decrypt("legacy"),"legacy");
});
test("credentials are encrypted on DB save, decrypted for signing and excluded from nested API responses",async()=>{
 process.env.ENCRYPTION_KEY="ab".repeat(32);
 const db=new CoinDCXDB() as any;let saved:any;db.accountRepo={save:async(a:any)=>{saved=a;return a;}};
 const account:any={accountMeta:{coindcx:{apiKey:"key",apiSecret:"secret",baseUrl:"https://api.coindcx.com"}}};
 await db.updateAccountMeta(account,{});
 assert.ok(saved.accountMeta.coindcx.apiKey.startsWith("enc:v1:"));
 const service=new CoinDCXService() as any;assert.equal(service.requireCredentials(saved).apiSecret,"secret");
 const safe=sanitizeCredentials({account:saved,access_token:"hidden",refreshToken:"hidden",mt5PollKey:"hidden"});
 assert.deepEqual(safe,{account:{accountMeta:{coindcx:{baseUrl:"https://api.coindcx.com"}}}});
 const merged=mergeAccountMeta(saved.accountMeta,{coindcx:{baseUrl:"https://example.invalid"}});
 assert.equal(merged.coindcx.apiKey,saved.accountMeta.coindcx.apiKey);
 assert.equal(encryptCredentials(merged).coindcx.apiKey,saved.accountMeta.coindcx.apiKey);
});
