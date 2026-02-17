import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./auth-schema";
// import { Resend } from "resend";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // requireEmailVerification: true,
    // sendResetPassword: async ({ user, url }) => {
    //   await resend.emails.send({
    //     from: "Auth <noreply@yourdomain.com>",
    //     to: user.email,
    //     subject: "Reset your password",
    //     html: `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p>`,
    //   });
    // },
  },
  // emailVerification: {
  //   sendOnSignUp: true,
  //   autoSignInAfterVerification: true,
  //   sendVerificationEmail: async ({ user, url }) => {
  //     await resend.emails.send({
  //       from: "Auth <noreply@yourdomain.com>",
  //       to: user.email,
  //       subject: "Verify your email address",
  //       html: `<p>Click the link below to verify your email:</p><p><a href="${url}">${url}</a></p>`,
  //     });
  //   },
  // },
  plugins: [username()],
});

export type Session = typeof auth.$Infer.Session;
