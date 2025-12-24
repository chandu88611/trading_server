// src/app/user/services/user.service.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserDBService } from "./user.db";
import {
  signAccessToken,
  signRefreshToken,
  Roles,
} from "../../../middleware/auth";
import { User } from "../../../entity/User";
import { AuthProvider } from "../../../entity/AuthProvider";
import { generateEmailVerificationToken } from "../utils/email-verification.util";
import { sendUserVerificationEmail } from "./email-verification.service";
import { UserBillingDetails } from "../../../entity/UserBillingDetails";

const SALT_ROUNDS = 12;
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

export class UserService {
  private db = new UserDBService();

  // ========== LOGIN WITH EMAIL/PASSWORD ==========
  async loginWithEmail(email: string, password: string) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const user = await this.db.findByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) throw new Error("Invalid credentials");

    const access = signAccessToken({ userId: user.id, roles: [Roles.USER] });
    const { refreshJwt } = await this.issueRefreshToken(user);

    return { user, accessToken: access, refreshToken: refreshJwt };
  }

  // ========== REGISTER WITH EMAIL/PASSWORD ==========
  async registerWithEmail(email: string, password: string, name?: string) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const exists = await this.db.findByEmail(email);
    if (exists) throw new Error("Email already registered");

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.db.createUser({
      email,
      name: name ?? null,
      passwordHash: hash,
      isEmailVerified: false,
    });

    const { raw, hash: tokenHash } = generateEmailVerificationToken();
    await this.db.setEmailVerificationToken(user.id, tokenHash);

    await sendUserVerificationEmail(user.email, raw);

    const access = signAccessToken({ userId: user.id, roles: [Roles.USER] });
    const { refreshJwt } = await this.issueRefreshToken(user);

    return {
      user,
      accessToken: access,
      refreshToken: refreshJwt,
      emailVerificationRequired: true,
    };
  }

  // ========== REGISTER/LOGIN WITH PROVIDER (GOOGLE, ETC) ==========
  async registerWithProvider(
    provider: string,
    providerUserId: string,
    email: string,
    name?: string
  ) {
    if (!provider || !providerUserId) {
      throw new Error("provider and providerUserId are required");
    }
    if (!email) {
      throw new Error("Email is required for provider signup");
    }

    let user: User | null = await this.db.findByEmail(email);

    // 1. If no user, create one with dummy password so DB NOT NULL is respected
    if (!user) {
      const dummyPassword = crypto.randomBytes(32).toString("hex");
      const dummyHash = await bcrypt.hash(dummyPassword, SALT_ROUNDS);

      user = await this.db.createUser({
        email,
        name: name ?? null,
        passwordHash: dummyHash,
        isEmailVerified: true,
      });
    }

    // 2. Ensure provider record exists for this user
    let providerDetails: AuthProvider | null = await this.db.getProvider(
      user.id
    );

    if (!providerDetails) {
      await this.db.createAuthProvider(user, provider, providerUserId, {
        createdAt: new Date(),
      });
    }

    // 3. Issue tokens
    const access = signAccessToken({ userId: user.id, roles: [Roles.USER] });
    const { refreshJwt } = await this.issueRefreshToken(user);

    return { user, accessToken: access, refreshToken: refreshJwt };
  }

  // ========== INTERNAL: ISSUE REFRESH TOKEN ==========
  private async issueRefreshToken(user: User): Promise<{ refreshJwt: string }> {
    const refreshPlain = crypto.randomBytes(48).toString("hex");
    const refreshHash = crypto
      .createHash("sha256")
      .update(refreshPlain)
      .digest("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.db.saveRefreshToken(user, refreshHash, expiresAt);

    const refreshJwt = signRefreshToken({
      userId: user.id,
      tokenHash: refreshHash,
    });

    return { refreshJwt };
  }

  async verifyEmail(token: string): Promise<void> {
    if (!token) {
      throw new Error("Invalid token");
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await this.db.findByVerificationToken(tokenHash);

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    await this.db.markEmailVerified(user.id);
  }
  async getUserDetails(userId: number): Promise<User> {
    try {
      return this.db.getUserDetails(userId);
    } catch (error) {
      throw error;
    }
  }
  async getBillingDetails(userId: number): Promise<UserBillingDetails | null> {
    try {
      return this.db.getBillingDetails(userId);
    } catch (error) {
      throw error;
    }
  }

  async upsertBillingDetails(
    userId: number,
    payload: Partial<UserBillingDetails>
  ): Promise<UserBillingDetails> {
    try {
      return this.db.upsertBillingDetails(userId, payload);
    } catch (error) {
      throw error;
    }
  }

  async updateTradeStatus(userId: number, allowTrade: boolean): Promise<User> {
    try {
      return this.db.updateTradeStatus(userId, allowTrade);
    } catch (error) {
      throw error;
    }
  }

  async updateCopyTradeStatus(
    userId: number,
    allowCopyTrade: boolean
  ): Promise<User> {
    try {
      return this.db.updateCopyTradeStatus(userId, allowCopyTrade);
    } catch (error) {
      throw error;
    }
  }
}
