import type {
  AbuseAction,
  AbuseIdentity,
  AbuseResult,
  AbuseDecision,
  GuardOptions,
} from "./types";
import { POLICY_MAP } from "./policies";
import { contentFingerprint } from "./fingerprint";
import { incrementCounter, checkDedup, logAbuseEvent } from "./store-redis";

function isEnabled(): boolean {
  return process.env.ABUSE_ENABLED !== "false";
}

function isShadowMode(): boolean {
  return process.env.ABUSE_MODE !== "enforce";
}

const DECISION_PRIORITY: Record<AbuseDecision, number> = {
  allow: 0,
  degrade_to_review: 1,
  throttle: 2,
  deny: 3,
};

/**
 * Core policy enforcement. Checks all rules for an action and returns the strictest decision.
 */
export async function enforceAbusePolicy(
  action: AbuseAction,
  identity: AbuseIdentity,
  opts?: GuardOptions,
): Promise<AbuseResult> {
  const policy = POLICY_MAP[action];
  if (!policy) {
    return { decision: "allow", reason: "no_policy" };
  }

  let strictest: AbuseResult = { decision: "allow", reason: "under_limit" };

  // Check dedup first
  if (policy.dedup && opts?.contentBody && identity.userId) {
    const hash = contentFingerprint(opts.contentBody);
    const dedupKey = `abuse:dedup:${action}:${identity.userId}:${hash}`;
    const isNew = await checkDedup(dedupKey, policy.dedup.windowSec);
    if (isNew === false) {
      // Duplicate content
      return {
        decision: "deny",
        reason: "duplicate_content",
        triggeredRule: `dedup:${policy.dedup.windowSec}s`,
      };
    }
    // isNew === null means Redis is down, fail open
  }

  // Check pending count if provided
  if (opts?.pendingCheck && opts.pendingMax !== undefined) {
    const pendingCount = await opts.pendingCheck();
    if (pendingCount >= opts.pendingMax) {
      return {
        decision: "deny",
        reason: "too_many_pending",
        currentCount: pendingCount,
        limit: opts.pendingMax,
      };
    }
  }

  // Check each rate limit rule
  for (const rule of policy.rules) {
    const keyValue = identity[rule.keyBy];
    if (!keyValue) continue;

    const redisKey = `abuse:rate:${action}:${rule.keyBy}:${keyValue}`;
    const count = await incrementCounter(redisKey, rule.windowSec);

    if (count === null) {
      // Redis is down — fail open
      return { decision: "allow", reason: "redis_down" };
    }

    let ruleDecision: AbuseDecision = "allow";
    if (count > rule.hardLimit) {
      ruleDecision = "deny";
    } else if (count > rule.softLimit) {
      ruleDecision = "throttle";
    }

    if (DECISION_PRIORITY[ruleDecision] > DECISION_PRIORITY[strictest.decision]) {
      strictest = {
        decision: ruleDecision,
        reason: `${rule.keyBy}:${rule.windowSec}s`,
        triggeredRule: `${rule.keyBy}:${rule.windowSec}s:${rule.softLimit}/${rule.hardLimit}`,
        currentCount: count,
        limit: ruleDecision === "deny" ? rule.hardLimit : rule.softLimit,
      };
    }
  }

  return strictest;
}

/**
 * Main guard function. In shadow mode, always returns allow but logs the actual decision.
 */
export async function guard(
  action: AbuseAction,
  identity: AbuseIdentity,
  opts?: GuardOptions,
): Promise<AbuseResult> {
  if (!isEnabled()) {
    return { decision: "allow", reason: "disabled" };
  }

  const result = await enforceAbusePolicy(action, identity, opts);

  // Log non-allow decisions
  if (result.decision !== "allow") {
    logAbuseEvent({
      action,
      decision: isShadowMode() ? `shadow:${result.decision}` : result.decision,
      reason: result.reason,
      userId: identity.userId,
      ipHash: identity.ipHash,
      timestamp: Date.now(),
    });

    // Persist to database (fire-and-forget)
    persistAbuseEvent(action, result, identity, isShadowMode() ? "shadow" : "enforce");
  }

  // In shadow mode, always allow
  if (isShadowMode()) {
    return { decision: "allow", reason: result.reason };
  }

  return result;
}

/**
 * Fire-and-forget INSERT into abuse_event table.
 */
async function persistAbuseEvent(
  action: string,
  result: AbuseResult,
  identity: AbuseIdentity,
  mode: string,
): Promise<void> {
  try {
    const { db } = await import("@/lib/db");
    const { abuseEvent } = await import("@/lib/schema");
    await db.insert(abuseEvent).values({
      action,
      decision: result.decision,
      reason: result.reason,
      triggeredRule: result.triggeredRule ?? null,
      currentCount: result.currentCount ?? null,
      limitValue: result.limit ?? null,
      userIdHash: identity.userId ?? null,
      ipHash: identity.ipHash ?? null,
      deviceHash: identity.deviceHash ?? null,
      mode,
    });
  } catch (err) {
    console.error("[abuse/guard] Failed to persist event:", err);
  }
}
