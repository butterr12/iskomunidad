"use server";

import { type ActionResult, getSession } from "./_helpers";
import {
  getUserFlairsFromDb,
  getVisibleFlairsByUsername,
  setFlairVisibility,
} from "@/lib/flair-service";
import type { DisplayFlair } from "@/lib/user-flairs";

export async function getMyFlairs(): Promise<ActionResult<DisplayFlair[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const flairs = await getUserFlairsFromDb(session.user.id);
  return { success: true, data: flairs };
}

export async function getFlairsForUser(
  username: string,
): Promise<ActionResult<DisplayFlair[]>> {
  const flairs = await getVisibleFlairsByUsername(username);
  return { success: true, data: flairs };
}

export async function toggleFlairVisibility(
  flairId: string,
  visible: boolean,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const result = await setFlairVisibility(session.user.id, flairId, visible);
  if (!result.success) {
    return { success: false, error: result.error! };
  }
  return { success: true, data: undefined };
}
