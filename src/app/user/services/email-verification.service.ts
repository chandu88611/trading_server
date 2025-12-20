import { sendVerificationEmail } from "../../../types/email.service";

export async function sendUserVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  await sendVerificationEmail({ email, token });
}
