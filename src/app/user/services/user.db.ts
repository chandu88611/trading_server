// src/app/user/services/user.db.ts
import AppDataSource from "../../../db/data-source";
import { User } from "../../../entity/User";
import { AuthProvider } from "../../../entity/AuthProvider";
import { RefreshToken } from "../../../entity/RefreshToken";
import { HttpStatusCode } from "../../../types/constants";

export class UserDBService {
  private userRepo = AppDataSource.getRepository(User);
  private authRepo = AppDataSource.getRepository(AuthProvider);
  private tokenRepo = AppDataSource.getRepository(RefreshToken);

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
      try{let userData:User|null = await this.userRepo.findOne({
        where: { id: userId },
        select: ["id", "email", "name", "isEmailVerified", "isActive", "isAdmin"],
      });
      if (!userData) {
        throw{
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "user_not_found"
        }
      } else {
        return userData;
        }}
        catch (error) {
          throw error;
        }
    }
}
