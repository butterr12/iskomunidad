import { NextResponse } from "next/server";

export async function GET() {
  const status = {
    ok: true,
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "NOT SET",
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    },
  };

  console.log("[health]", JSON.stringify(status));
  return NextResponse.json(status);
}
