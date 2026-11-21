import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

let client: Resend | undefined;

/**
 * Sends one email. Without RESEND_API_KEY (local development) the message
 * is printed to the server console instead, so sign-up still works.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    console.info(
      `\n[email:dev] to=${message.to}\nsubject: ${message.subject}\n\n${message.text}\n`,
    );
    return;
  }
  client ??= new Resend(RESEND_API_KEY);
  const { error } = await client.emails.send({
    from: EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (error) {
    throw new Error(`Email to ${message.to} failed: ${error.message}`);
  }
}
