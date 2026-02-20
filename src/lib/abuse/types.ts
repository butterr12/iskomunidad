export type AbuseAction =
  | "auth.signup"
  | "auth.login"
  | "post.create"
  | "post.vote"
  | "comment.create"
  | "comment.vote"
  | "event.create"
  | "event.rsvp"
  | "gig.create"
  | "gig.swipe"
  | "follow.toggle"
  | "conversation.create"
  | "message.send"
  | "upload.image"
  | "landmark.create"
  | "landmark.review"
  | "socket.typing"
  | "socket.join";

export type AbuseKeyBy = "userId" | "ipHash" | "emailHash" | "deviceHash";

export interface AbuseIdentity {
  userId?: string;
  ipHash?: string;
  deviceHash?: string;
  emailHash?: string;
}

export interface PolicyRule {
  keyBy: AbuseKeyBy;
  windowSec: number;
  softLimit: number;
  hardLimit: number;
}

export interface PolicyDefinition {
  rules: PolicyRule[];
  dedup?: { windowSec: number };
}

export type AbuseDecision = "allow" | "throttle" | "deny" | "degrade_to_review";

export interface AbuseResult {
  decision: AbuseDecision;
  reason: string;
  triggeredRule?: string;
  currentCount?: number;
  limit?: number;
}

export interface GuardOptions {
  identity?: AbuseIdentity;
  contentBody?: string;
  pendingCheck?: () => Promise<number>;
  pendingMax?: number;
}
