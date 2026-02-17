"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { ActionResult } from "./_helpers";

export async function setPassword(newPassword: string): Promise<ActionResult> {
  try {
    await auth.api.setPassword({
      body: { newPassword },
      headers: await headers(),
    });
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to set password",
    };
  }
}
