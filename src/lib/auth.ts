import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, magicLink } from "better-auth/plugins";
import * as authSchema from "./auth-schema";
import { db } from "./db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: "iskomunidad <no-reply@hello.iskomunidad.com>",
        to: user.email,
        subject: "Reset your password",
        html: `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: "iskomunidad <no-reply@hello.iskomunidad.com>",
        to: user.email,
        subject: "Verify your email address",
        html: `<p>Click the link below to verify your email:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },
  plugins: [
    username(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: "iskomunidad <no-reply@hello.iskomunidad.com>",
          to: email,
          subject: "Sign in to iskomunidad",
          html: `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p>`,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
