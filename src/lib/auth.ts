import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, magicLink } from "better-auth/plugins";
import { render } from "@react-email/components";
import * as authSchema from "./auth-schema";
import { db } from "./db";
import { Resend } from "resend";
import { VerifyEmail } from "@/emails/verify-email";
import { ResetPassword } from "@/emails/reset-password";
import { MagicLink } from "@/emails/magic-link";

if (!process.env.RESEND_API_KEY) {
  console.warn("[auth] RESEND_API_KEY is not set — emails will not be sent");
}
if (!process.env.BETTER_AUTH_URL) {
  console.warn("[auth] BETTER_AUTH_URL is not set — auth redirects may fail");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom = "iskomunidad <no-reply@hello.iskomunidad.com>";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const html = await render(ResetPassword({ url, name: user.name }));
      await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: "Reset your password",
        html,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const html = await render(VerifyEmail({ url, name: user.name }));
      await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: "Verify your email address",
        html,
      });
    },
  },
  plugins: [
    username(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const html = await render(MagicLink({ url }));
        await resend.emails.send({
          from: emailFrom,
          to: email,
          subject: "Sign in to iskomunidad",
          html,
        });
      },
    }),
  ],
});
