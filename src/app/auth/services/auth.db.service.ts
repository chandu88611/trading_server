import { Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { User } from "../../../entity/User";

export class AuthDBService {
  private readonly userRepo: Repository<User>;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
    });
  }

  async createUser(user: Partial<User>): Promise<User> {
    return this.userRepo.save(this.userRepo.create(user));
  }

  async setVerificationToken(
    userId: number,
    tokenHash: string
  ): Promise<void> {
    await this.userRepo.update(
      { id: userId },
      { verificationToken: tokenHash }
    );
  }

  async findByVerificationToken(
    tokenHash: string
  ): Promise<User | null> {
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
}
