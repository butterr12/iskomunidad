import type { AbuseAction, PolicyDefinition } from "./types";

export const POLICY_MAP: Record<AbuseAction, PolicyDefinition> = {
  "auth.signup": {
    rules: [
      { keyBy: "ipHash", windowSec: 15 * 60, softLimit: 3, hardLimit: 6 },
      { keyBy: "emailHash", windowSec: 24 * 60 * 60, softLimit: 3, hardLimit: 3 },
    ],
  },
  "auth.login": {
    rules: [
      { keyBy: "ipHash", windowSec: 15 * 60, softLimit: 20, hardLimit: 40 },
    ],
  },
  "post.create": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 3, hardLimit: 6 },
      { keyBy: "userId", windowSec: 24 * 60 * 60, softLimit: 20, hardLimit: 20 },
    ],
    dedup: { windowSec: 5 * 60 },
  },
  "post.vote": {
    rules: [
      { keyBy: "userId", windowSec: 60, softLimit: 30, hardLimit: 60 },
    ],
  },
  "comment.create": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 15, hardLimit: 30 },
    ],
    dedup: { windowSec: 2 * 60 },
  },
  "comment.vote": {
    rules: [
      { keyBy: "userId", windowSec: 60, softLimit: 30, hardLimit: 60 },
    ],
  },
  "event.create": {
    rules: [
      { keyBy: "userId", windowSec: 30 * 60, softLimit: 2, hardLimit: 5 },
    ],
    dedup: { windowSec: 10 * 60 },
  },
  "event.rsvp": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 60, hardLimit: 120 },
    ],
  },
  "gig.create": {
    rules: [
      { keyBy: "userId", windowSec: 30 * 60, softLimit: 2, hardLimit: 5 },
    ],
    dedup: { windowSec: 10 * 60 },
  },
  "gig.swipe": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 60, hardLimit: 120 },
    ],
  },
  "conversation.create": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 5, hardLimit: 10 },
    ],
  },
  "message.send": {
    rules: [
      { keyBy: "userId", windowSec: 5 * 60, softLimit: 20, hardLimit: 40 },
    ],
  },
  "follow.toggle": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 30, hardLimit: 60 },
    ],
  },
  "upload.image": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 10, hardLimit: 20 },
      { keyBy: "ipHash", windowSec: 10 * 60, softLimit: 15, hardLimit: 30 },
    ],
  },
  "landmark.create": {
    rules: [
      { keyBy: "userId", windowSec: 30 * 60, softLimit: 2, hardLimit: 5 },
    ],
  },
  "landmark.review": {
    rules: [
      { keyBy: "userId", windowSec: 10 * 60, softLimit: 10, hardLimit: 20 },
    ],
  },
  "socket.typing": {
    rules: [
      { keyBy: "userId", windowSec: 10, softLimit: 5, hardLimit: 10 },
    ],
  },
  "socket.join": {
    rules: [
      { keyBy: "userId", windowSec: 60, softLimit: 20, hardLimit: 40 },
    ],
  },
};
