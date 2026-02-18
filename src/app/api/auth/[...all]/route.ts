import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const url = new URL(request.url);
  // Block all direct signup endpoints — signup must go through server actions
  // that record legal consent first.
  if (url.pathname.includes("/sign-up/")) {
    return Response.json(
      { error: "Direct signup not allowed" },
      { status: 403 },
    );
  }
  return handler.POST(request);
}
