// src/app/user/services/user.db.ts
import AppDataSource from "../../../db/data-source";
import { User } from "../../../entity/User";
import { AuthProvider } from "../../../entity/AuthProvider";
import { RefreshToken } from "../../../entity/RefreshToken";
import { HttpStatusCode } from "../../../types/constants";
import { UserBillingDetails } from "../../../entity/UserBillingDetails";

export class UserDBService {
  private userRepo = AppDataSource.getRepository(User);
  private authRepo = AppDataSource.getRepository(AuthProvider);
  private tokenRepo = AppDataSource.getRepository(RefreshToken);
  private billingRepo = AppDataSource.getRepository(UserBillingDetails);

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async getProvider(userId: number): Promise<AuthProvider | null> {
    return this.authRepo.findOne({ where: { userId } });
  }

  async createUser(params: {
    email: string;
    name?: string | null;
    passwordHash: string;
    isEmailVerified?: boolean;
  }): Promise<User> {
    const u = this.userRepo.create({
      email: params.email,
      name: params.name ?? null,
      passwordHash: params.passwordHash,
      isEmailVerified: params.isEmailVerified ?? false,
      isActive: true,
    });
    return this.userRepo.save(u);
  }

  async createAuthProvider(
    user: User,
    provider: string,
    providerUserId: string,
    meta?: Record<string, any>
  ): Promise<AuthProvider> {
    const ap = this.authRepo.create({
      user,
      userId: user.id,
      provider,
      providerUserId: `${providerUserId}`,
      providerMeta: meta,
    });
    return this.authRepo.save(ap);
  }

  // ========= REFRESH TOKENS ==========

  async saveRefreshToken(
    user: User,
    tokenHash: string,
    expiresAt?: Date
  ): Promise<RefreshToken> {
    const rt = this.tokenRepo.create({
      user,
      userId: user.id,
      tokenHash,
      expiresAt: expiresAt ?? null,
      revoked: false,
    });
    return this.tokenRepo.save(rt);
  }

  async findRefreshTokenByHash(
    tokenHash: string
  ): Promise<RefreshToken | null> {
    return this.tokenRepo.findOne({
      where: { tokenHash },
      relations: ["user"],
    });
  }

  async findRefreshTokenForUser(
    userId: number,
    tokenHash: string
  ): Promise<RefreshToken | null> {
    return this.tokenRepo.findOne({
      where: { tokenHash, userId },
      relations: ["user"],
    });
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
    await this.tokenRepo.update({ tokenHash }, { revoked: true });
  }

  async revokeAllRefreshTokensForUser(userId: number): Promise<void> {
    await this.tokenRepo.update({ userId }, { revoked: true });
  }
  async setEmailVerificationToken(
    userId: number,
    tokenHash: string
  ): Promise<void> {
    await this.userRepo.update(
      { id: userId },
      { verificationToken: tokenHash }
    );
  }

  async findByVerificationToken(tokenHash: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        verificationToken: tokenHash,
        isEmailVerified: false,
      },
    });
  }

  async markEmailVerified(userId: number): Promise<void> {
    await this.userRepo.update(
      { id: userId },
      {
        isEmailVerified: true,
        verificationToken: null,
      }
    );
  }

  async getUserDetails(userId: number): Promise<User> {
    try {
      let userData: User | null = await this.userRepo.findOne({
        where: { id: userId },
        select: [
          "id",
          "email",
          "name",
          "isEmailVerified",
          "isActive",
          "isAdmin",
          "allowTrade",
          "createdAt",
          "updatedAt",
        ],
      });
      if (!userData) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "user_not_found",
        };
      } else {
        return userData;
      }
    } catch (error) {
      throw error;
    }
  }
  async getBillingDetails(userId: number): Promise<UserBillingDetails | null> {
    try {
      return this.billingRepo.findOne({
        where: { userId: String(userId) },
      });
    } catch (error) {
      throw error;
    }
  }

  async upsertBillingDetails(
    userId: number,
    payload: Partial<UserBillingDetails>
  ): Promise<UserBillingDetails> {
    try {
      const existing = await this.billingRepo.findOne({
        where: { userId: String(userId) },
      });

      if (existing) {
        // update only provided fields (don’t wipe with undefined)
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined) (existing as any)[k] = v;
        });

        // never allow changing userId
        (existing as any).userId = String(userId);

        return this.billingRepo.save(existing);
      }

      const created = this.billingRepo.create({
        userId: String(userId),
        panNumber: payload.panNumber ?? null,
        accountHolderName: payload.accountHolderName ?? null,
        accountNumber: payload.accountNumber ?? null,
        ifscCode: payload.ifscCode ?? null,
        bankName: payload.bankName ?? null,
        branch: payload.branch ?? null,
        addressLine1: payload.addressLine1 ?? null,
        addressLine2: payload.addressLine2 ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
      });

      return this.billingRepo.save(created);
    } catch (error) {
      throw error;
    }
  }

  async updateTradeStatus(userId: number, allowTrade: boolean): Promise<User> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "user_not_found",
        };
      }
      user.allowTrade = allowTrade;
      return this.userRepo.save(user);
    } catch (error) {
      throw error;
    }
  }
}
