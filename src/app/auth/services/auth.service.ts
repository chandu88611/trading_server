import { sendVerificationEmail } from "../../../types/email.service";
import { generateRawToken, hashToken } from "../../../types/token";
import { AuthDBService } from "./auth.db.service";

export class AuthService {
  private readonly authDB: AuthDBService;

  constructor() {
    this.authDB = new AuthDBService();
  }

  async registerUser(email: string): Promise<void> {
    const existingUser = await this.authDB.findByEmail(email);

    // Do NOT reveal whether user exists
    if (existingUser && existingUser.isEmailVerified) {
      return;
    }

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);

    let userId: number;

    if (!existingUser) {
      const user = await this.authDB.createUser({
        email,
        passwordHash: "TEMP_BLOCKED", // replace with real hash later
        isEmailVerified: false,
      });
      userId = user.id;
    } else {
      userId = existingUser.id;
    }

    await this.authDB.setVerificationToken(userId, tokenHash);

    await sendVerificationEmail({
      email,
      token: rawToken,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);

    const user = await this.authDB.findByVerificationToken(tokenHash);

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    await this.authDB.markEmailVerified(user.id);
  }
}
