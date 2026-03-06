import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user, session, account } from "./auth-schema";

// Re-export auth tables so everything is accessible from one place
export { user, session, account, verification } from "./auth-schema";

// ─── Place Category ─────────────────────────────────────────────────────────

export const placeCategory = pgTable("place_category", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(), // lucide icon name
  color: text("color").notNull(), // hex color
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Landmark ──────────────────────────────────────────────────────────────────

export const landmark = pgTable("landmark", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // "attraction" | "community" | "event" (legacy)
  categoryId: uuid("category_id").references(() => placeCategory.id, { onDelete: "set null" }),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  address: text("address"),
  googlePlaceId: text("google_place_id"),
  phone: text("phone"),
  website: text("website"),
  operatingHours: jsonb("operating_hours"),
  tags: text("tags").array().notNull().default([]),
  avgRating: doublePrecision("avg_rating").default(0),
  reviewCount: integer("review_count").default(0),
  status: text("status").notNull().default("draft"), // "draft" | "approved" | "rejected"
  rejectionReason: text("rejection_reason"),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("landmark_tags_gin_idx").using("gin", table.tags),
]);

// ─── Landmark Photo ────────────────────────────────────────────────────────────

export const landmarkPhoto = pgTable("landmark_photo", {
  id: uuid("id").defaultRandom().primaryKey(),
  landmarkId: uuid("landmark_id")
    .notNull()
    .references(() => landmark.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  source: text("source").notNull().default("upload"), // "upload" | "google_places"
  attribution: text("attribution"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Landmark Review ───────────────────────────────────────────────────────────

export const landmarkReview = pgTable(
  "landmark_review",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    landmarkId: uuid("landmark_id")
      .notNull()
      .references(() => landmark.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1-5
    body: text("body"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("landmark_review_user_landmark_idx").on(
      table.userId,
      table.landmarkId,
    ),
  ],
);

// ─── Landmark Edit Suggestion ─────────────────────────────────────────────────

export const landmarkEdit = pgTable("landmark_edit", {
  id: uuid("id").defaultRandom().primaryKey(),
  landmarkId: uuid("landmark_id")
    .notNull()
    .references(() => landmark.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  changes: jsonb("changes").notNull(), // partial landmark fields
  note: text("note"),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Community Post ────────────────────────────────────────────────────────────

export const communityPost = pgTable("community_post", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type").notNull(), // "text" | "link"
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  flair: text("flair").notNull(), // "Discussion" | "Question" | etc.
  locationId: uuid("location_id").references(() => landmark.id, {
    onDelete: "set null",
  }),
  eventId: uuid("event_id").references(() => campusEvent.id, { onDelete: "set null" }),
  score: integer("score").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  linkUrl: text("link_url"),
  tags: text("tags").array().notNull().default([]),
  imageColor: text("image_color"),
  imageEmoji: text("image_emoji"),
  status: text("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  draftSource: text("draft_source"), // "user" | "moderation"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("community_post_tags_gin_idx").using("gin", table.tags),
]);

// ─── Post Image ───────────────────────────────────────────────────────────────

export const postImage = pgTable("post_image", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => communityPost.id, { onDelete: "cascade" }),
  imageKey: text("image_key").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Post Comment ──────────────────────────────────────────────────────────────

export const postComment = pgTable("post_comment", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => communityPost.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Post Vote ─────────────────────────────────────────────────────────────────

export const postVote = pgTable(
  "post_vote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPost.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    value: integer("value").notNull(), // 1 or -1
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_vote_user_post_idx").on(table.userId, table.postId),
  ],
);

// ─── Comment Vote ──────────────────────────────────────────────────────────────

export const commentVote = pgTable(
  "comment_vote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => postComment.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    value: integer("value").notNull(), // 1 or -1
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("comment_vote_user_comment_idx").on(
      table.userId,
      table.commentId,
    ),
  ],
);

// ─── Post Bookmark ────────────────────────────────────────────────────────────

export const postBookmark = pgTable(
  "post_bookmark",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPost.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_bookmark_user_post_idx").on(table.userId, table.postId),
  ],
);

// ─── Campus Event ──────────────────────────────────────────────────────────────

export const campusEvent = pgTable("campus_event", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // "academic" | "cultural" | "social" | "sports" | "org"
  organizer: text("organizer").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  locationId: uuid("location_id").references(() => landmark.id, {
    onDelete: "set null",
  }),
  tags: text("tags").array().notNull().default([]),
  coverColor: text("cover_color").notNull().default("#3b82f6"),
  coverImageKey: text("cover_image_key"),
  attendeeCount: integer("attendee_count").notNull().default(0),
  interestedCount: integer("interested_count").notNull().default(0),
  externalLinks: jsonb("external_links").default([]),
  status: text("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("campus_event_tags_gin_idx").using("gin", table.tags),
]);

// ─── Event RSVP ────────────────────────────────────────────────────────────────

export const eventRsvp = pgTable(
  "event_rsvp",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => campusEvent.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // "going" | "interested"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("event_rsvp_user_event_idx").on(table.userId, table.eventId),
  ],
);

// ─── Gig Listing ───────────────────────────────────────────────────────────────

export const gigListing = pgTable("gig_listing", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  posterCollege: text("poster_college"),
  compensation: text("compensation").notNull(),
  compensationValue: integer("compensation_value").notNull().default(0),
  isPaid: boolean("is_paid").notNull().default(true),
  category: text("category").notNull(), // "tutoring" | "research" | etc.
  tags: text("tags").array().notNull().default([]),
  locationId: uuid("location_id").references(() => landmark.id, {
    onDelete: "set null",
  }),
  locationNote: text("location_note"),
  deadline: timestamp("deadline"),
  urgency: text("urgency").notNull().default("flexible"),
  isOpen: boolean("is_open").notNull().default(true),
  applicantCount: integer("applicant_count").notNull().default(0),
  contactMethod: text("contact_method").notNull(),
  status: text("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("gig_listing_tags_gin_idx").using("gin", table.tags),
]);

// ─── Gig Swipe ─────────────────────────────────────────────────────────────────

export const gigSwipe = pgTable(
  "gig_swipe",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gigId: uuid("gig_id")
      .notNull()
      .references(() => gigListing.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // "saved" | "skipped"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("gig_swipe_user_gig_idx").on(table.userId, table.gigId),
  ],
);

// ─── Admin Setting ────────────────────────────────────────────────────────────

export const adminSetting = pgTable("admin_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── Admin Notification ────────────────────────────────────────────────────────

export const adminNotification = pgTable("admin_notification", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // "approved" | "rejected" | "event_approved" | etc.
  targetId: text("target_id").notNull(),
  targetTitle: text("target_title").notNull(),
  authorHandle: text("author_handle").notNull(),
  reason: text("reason"),
  readByAdmin: boolean("read_by_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── User Notification ───────────────────────────────────────────────────────

export const userNotification = pgTable("user_notification", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),           // e.g. "post_approved", "post_rejected"
  contentType: text("content_type").notNull(), // "post" | "gig" | "event" | "landmark"
  targetId: text("target_id").notNull(),
  targetTitle: text("target_title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("user_notification_user_created_idx").on(table.userId, table.createdAt),
  index("user_notification_user_read_idx").on(table.userId, table.isRead),
]);

// ─── User Notification Setting ───────────────────────────────────────────────

export const userNotificationSetting = pgTable("user_notification_setting", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  posts: boolean("posts").notNull().default(true),
  events: boolean("events").notNull().default(true),
  gigs: boolean("gigs").notNull().default(false),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── User Legal Consent ──────────────────────────────────────────────────────

export const userLegalConsent = pgTable(
  "user_legal_consent",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    consentType: text("consent_type").notNull().default("signup"),
    termsVersion: text("terms_version").notNull(),
    privacyVersion: text("privacy_version").notNull(),
    legalNoticeVersion: text("legal_notice_version").notNull(),
    agreedToTerms: boolean("agreed_to_terms").notNull().default(false),
    agreedToPrivacy: boolean("agreed_to_privacy").notNull().default(false),
    ageAttested: boolean("age_attested").notNull().default(false),
    guardianConsentAttested: boolean("guardian_consent_attested")
      .notNull()
      .default(false),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_legal_consent_user_created_idx").on(table.userId, table.createdAt),
    index("user_legal_consent_email_created_idx").on(table.email, table.createdAt),
  ],
);

// ─── User Follow ────────────────────────────────────────────────────────────

export const userFollow = pgTable(
  "user_follow",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_follow_pair_idx").on(table.followerId, table.followingId),
    index("user_follow_follower_idx").on(table.followerId),
    index("user_follow_following_idx").on(table.followingId),
  ],
);

// ─── User Privacy Setting ───────────────────────────────────────────────────

export const userPrivacySetting = pgTable("user_privacy_setting", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  allowFollowsFrom: text("allow_follows_from").notNull().default("everyone"), // "everyone" | "nobody"
  allowMessagesFrom: text("allow_messages_from").notNull().default("everyone"), // "everyone" | "nobody"
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Conversation ──────────────────────────────────────────────────────────────

export const conversation = pgTable("conversation", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull().default("direct"), // "direct" | "campus_match" | "anon_chat"
  isRequest: boolean("is_request").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: text("deleted_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  deleteKind: text("delete_kind"), // "conversation" | "request"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Conversation Participant ──────────────────────────────────────────────────

export const conversationParticipant = pgTable(
  "conversation_participant",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
  },
  (table) => [
    uniqueIndex("conversation_participant_conv_user_idx").on(
      table.conversationId,
      table.userId,
    ),
    index("conversation_participant_user_idx").on(table.userId),
  ],
);

// ─── Message ───────────────────────────────────────────────────────────────────

export const message = pgTable(
  "message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_conv_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

// ─── Message Request ───────────────────────────────────────────────────────────

export const messageRequest = pgTable(
  "message_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // "pending" | "accepted" | "declined" | "withdrawn"
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("message_request_conv_idx").on(table.conversationId),
    index("message_request_to_user_status_idx").on(
      table.toUserId,
      table.status,
    ),
    index("message_request_from_user_status_idx").on(
      table.fromUserId,
      table.status,
    ),
    index("message_request_status_resolved_idx").on(
      table.status,
      table.resolvedAt,
    ),
  ],
);

// ─── User Selected Border ───────────────────────────────────────────────────

export const userSelectedBorder = pgTable("user_selected_border", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  borderId: text("border_id").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── User Unlocked Border ───────────────────────────────────────────────────

export const userUnlockedBorder = pgTable(
  "user_unlocked_border",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    borderId: text("border_id").notNull(),
    unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_unlocked_border_user_border_idx").on(
      table.userId,
      table.borderId,
    ),
    index("user_unlocked_border_user_idx").on(table.userId),
  ],
);

// ─── User Flair ──────────────────────────────────────────────────────────────

export const userFlair = pgTable(
  "user_flair",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    flairId: text("flair_id").notNull(),
    visible: boolean("visible").notNull().default(false),
    source: text("source").notNull().default("admin"), // "admin" | "basic-seed" | "university-sync" | "system"
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_flair_user_flair_idx").on(table.userId, table.flairId),
    index("user_flair_user_idx").on(table.userId),
  ],
);

// ─── Campus Match: Preference ───────────────────────────────────────────────

export const cmPreference = pgTable("cm_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  allowAnonQueue: boolean("allow_anon_queue").notNull().default(true),
  defaultAlias: text("default_alias"),
  lastScope: text("last_scope"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Campus Match: Queue Entry ──────────────────────────────────────────────

export const cmQueueEntry = pgTable(
  "cm_queue_entry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    scope: text("scope").notNull(),
    heartbeatAt: timestamp("heartbeat_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cm_queue_entry_user_idx").on(table.userId),
    index("cm_queue_entry_scope_idx").on(table.scope),
    index("cm_queue_entry_created_idx").on(table.createdAt),
    index("cm_queue_entry_heartbeat_idx").on(table.heartbeatAt),
    index("cm_queue_entry_scope_created_heartbeat_idx").on(
      table.scope,
      table.createdAt,
      table.heartbeatAt,
    ),
  ],
);

// ─── Campus Match: Session ──────────────────────────────────────────────────

export const cmSession = pgTable("cm_session", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull().default("anon_chat"), // "anon_chat" | "campus_match"
  status: text("status").notNull().default("active"),
  endedReason: text("ended_reason"),
  expiresAt: timestamp("expires_at"), // only for campus_match (48h)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

// ─── Campus Match: Session Participant ──────────────────────────────────────

export const cmSessionParticipant = pgTable(
  "cm_session_participant",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => cmSession.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    connectRequested: boolean("connect_requested").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cm_session_participant_session_user_idx").on(
      table.sessionId,
      table.userId,
    ),
    index("cm_session_participant_user_idx").on(table.userId),
  ],
);

// ─── Campus Match: Message ──────────────────────────────────────────────────

export const cmMessage = pgTable(
  "cm_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => cmSession.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cm_message_session_created_idx").on(
      table.sessionId,
      table.createdAt,
    ),
  ],
);

// ─── Campus Match: Report ───────────────────────────────────────────────────

export const cmReport = pgTable(
  "cm_report",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => cmSession.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reportedUserId: text("reported_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    adminNote: text("admin_note"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cm_report_session_reporter_idx").on(
      table.sessionId,
      table.reporterId,
    ),
    index("cm_report_status_created_idx").on(table.status, table.createdAt),
    index("cm_report_reported_user_idx").on(table.reportedUserId),
  ],
);

// ─── Campus Match: Block ────────────────────────────────────────────────────

export const cmBlock = pgTable(
  "cm_block",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cm_block_pair_idx").on(table.blockerId, table.blockedId),
    index("cm_block_blocker_idx").on(table.blockerId),
    index("cm_block_blocked_idx").on(table.blockedId),
  ],
);

// ─── Campus Match: Rematch Cooldown ─────────────────────────────────────────

export const cmRematchCooldown = pgTable(
  "cm_rematch_cooldown",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userIdLow: text("user_id_low")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userIdHigh: text("user_id_high")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cm_rematch_cooldown_pair_idx").on(
      table.userIdLow,
      table.userIdHigh,
    ),
    index("cm_rematch_cooldown_expires_idx").on(table.expiresAt),
  ],
);

// ─── Campus Match: Ban ───────────────────────────────────────────────────────

export const cmBan = pgTable(
  "cm_ban",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceReportId: uuid("source_report_id").references(() => cmReport.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    liftedAt: timestamp("lifted_at"),
    liftedBy: text("lifted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("cm_ban_user_active_idx").on(
      table.userId,
      table.liftedAt,
      table.expiresAt,
    ),
    index("cm_ban_expires_idx").on(table.expiresAt),
    index("cm_ban_report_idx").on(table.sourceReportId),
  ],
);

// ─── Match: Prompt Pool (admin-managed) ─────────────────────────────────────

export const matchPromptPool = pgTable("match_prompt_pool", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: text("category").notNull(), // "vulnerability" | "taste" | "campus" | "flirty"
  promptText: text("prompt_text").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Match: Profile ─────────────────────────────────────────────────────────

export const matchProfile = pgTable("match_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  interests: text("interests").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  setupScreen: integer("setup_screen"), // null = complete, 0-6 = onboarding step
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Match: Profile Prompt (user's chosen prompts + answers) ────────────────

export const matchProfilePrompt = pgTable(
  "match_profile_prompt",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => matchProfile.id, { onDelete: "cascade" }),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => matchPromptPool.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("match_profile_prompt_profile_idx").on(table.profileId),
  ],
);

// ─── Match: Profile Photo ────────────────────────────────────────────────────

export const matchProfilePhoto = pgTable(
  "match_profile_photo",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => matchProfile.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("match_profile_photo_profile_idx").on(table.profileId),
  ],
);

// ─── Match: Swipe ───────────────────────────────────────────────────────────

export const matchSwipe = pgTable(
  "match_swipe",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    swiperId: text("swiper_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(), // "like" | "pass"
    likedContentType: text("liked_content_type"), // "photo" | "prompt" | null
    likedContentId: uuid("liked_content_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("match_swipe_pair_idx").on(table.swiperId, table.targetId),
    index("match_swipe_target_idx").on(table.targetId),
    index("match_swipe_swiper_created_idx").on(table.swiperId, table.createdAt),
  ],
);

// ─── Match: Match ───────────────────────────────────────────────────────────

export const matchMatch = pgTable(
  "match_match",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userIdA: text("user_id_a")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userIdB: text("user_id_b")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => cmSession.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"), // "active" | "expired" | "promoted" | "ended"
    likedContentType: text("liked_content_type"), // "photo" | "prompt" | null
    likedContentId: uuid("liked_content_id"),
    matchedAt: timestamp("matched_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("match_match_pair_idx").on(table.userIdA, table.userIdB),
    index("match_match_user_a_idx").on(table.userIdA),
    index("match_match_user_b_idx").on(table.userIdB),
    index("match_match_status_idx").on(table.status),
    index("match_match_expires_idx").on(table.expiresAt),
  ],
);

// ─── Match: Pic Swap ────────────────────────────────────────────────────────

export const matchPicSwap = pgTable("match_pic_swap", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => cmSession.id, { onDelete: "cascade" }),
  initiatorId: text("initiator_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "uploading" | "revealed" | "declined"
  imageKeyA: text("image_key_a"),
  imageKeyB: text("image_key_b"),
  uploadedAtA: timestamp("uploaded_at_a"),
  uploadedAtB: timestamp("uploaded_at_b"),
  revealedAt: timestamp("revealed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Banner ──────────────────────────────────────────────────────────────────

export const banner = pgTable("banner", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  variant: text("variant").notNull().default("info"), // "info" | "warning" | "urgent" | "success"
  ctaLabel: text("cta_label"),
  ctaUrl: text("cta_url"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Banner Dismissal ─────────────────────────────────────────────────────────

export const bannerDismissal = pgTable(
  "banner_dismissal",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bannerId: uuid("banner_id")
      .notNull()
      .references(() => banner.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("banner_dismissal_uq").on(t.bannerId, t.userId)],
);

// ─── Announcement ─────────────────────────────────────────────────────────────

export const announcement = pgTable("announcement", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  imageKey: text("image_key"),
  ctaLabel: text("cta_label"),
  ctaUrl: text("cta_url"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Announcement Seen ────────────────────────────────────────────────────────

export const announcementSeen = pgTable(
  "announcement_seen",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcement.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("announcement_seen_uq").on(t.announcementId, t.userId)],
);

// ─── Abuse Event ──────────────────────────────────────────────────────────────

export const abuseEvent = pgTable(
  "abuse_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: text("action").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason"),
    triggeredRule: text("triggered_rule"),
    currentCount: integer("current_count"),
    limitValue: integer("limit_value"),
    userIdHash: text("user_id_hash"),
    ipHash: text("ip_hash"),
    deviceHash: text("device_hash"),
    mode: text("mode").notNull().default("enforce"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("abuse_event_action_created_idx").on(table.action, table.createdAt),
    index("abuse_event_decision_created_idx").on(table.decision, table.createdAt),
    index("abuse_event_user_id_hash_idx").on(table.userIdHash),
    index("abuse_event_created_idx").on(table.createdAt),
  ],
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  landmarks: many(landmark),
  landmarkReviews: many(landmarkReview),
  landmarkEdits: many(landmarkEdit),
  communityPosts: many(communityPost),
  postComments: many(postComment),
  postVotes: many(postVote),
  postBookmarks: many(postBookmark),
  commentVotes: many(commentVote),
  campusEvents: many(campusEvent),
  eventRsvps: many(eventRsvp),
  gigListings: many(gigListing),
  gigSwipes: many(gigSwipe),
  userNotifications: many(userNotification),
  bannerDismissals: many(bannerDismissal),
  announcementsSeen: many(announcementSeen),
  legalConsents: many(userLegalConsent),
  notificationSetting: one(userNotificationSetting, {
    fields: [user.id],
    references: [userNotificationSetting.userId],
  }),
  following: many(userFollow, { relationName: "follower" }),
  followers: many(userFollow, { relationName: "following" }),
  privacySetting: one(userPrivacySetting, {
    fields: [user.id],
    references: [userPrivacySetting.userId],
  }),
  conversationParticipants: many(conversationParticipant),
  sentMessages: many(message),
  selectedBorder: one(userSelectedBorder, {
    fields: [user.id],
    references: [userSelectedBorder.userId],
  }),
  unlockedBorders: many(userUnlockedBorder),
  flairs: many(userFlair),
  cmPreference: one(cmPreference, {
    fields: [user.id],
    references: [cmPreference.userId],
  }),
  cmQueueEntries: many(cmQueueEntry),
  cmSessionParticipants: many(cmSessionParticipant),
  cmSentMessages: many(cmMessage),
  cmReportsFiled: many(cmReport, { relationName: "reporter" }),
  cmReportsReceived: many(cmReport, { relationName: "reportedUser" }),
  cmBlocksInitiated: many(cmBlock, { relationName: "blocker" }),
  cmBlocksReceived: many(cmBlock, { relationName: "blocked" }),
  cmBans: many(cmBan, { relationName: "bannedUser" }),
  cmBansIssued: many(cmBan, { relationName: "banCreator" }),
  cmBansLifted: many(cmBan, { relationName: "banLifter" }),
  matchProfile: one(matchProfile, {
    fields: [user.id],
    references: [matchProfile.userId],
  }),
  matchSwipesSent: many(matchSwipe, { relationName: "swiper" }),
  matchSwipesReceived: many(matchSwipe, { relationName: "swipeTarget" }),
  matchesAsA: many(matchMatch, { relationName: "matchUserA" }),
  matchesAsB: many(matchMatch, { relationName: "matchUserB" }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const placeCategoryRelations = relations(placeCategory, ({ many }) => ({
  landmarks: many(landmark),
}));

export const landmarkRelations = relations(landmark, ({ one, many }) => ({
  user: one(user, {
    fields: [landmark.userId],
    references: [user.id],
  }),
  placeCategory: one(placeCategory, {
    fields: [landmark.categoryId],
    references: [placeCategory.id],
  }),
  photos: many(landmarkPhoto),
  reviews: many(landmarkReview),
  edits: many(landmarkEdit),
  communityPosts: many(communityPost),
  campusEvents: many(campusEvent),
  gigListings: many(gigListing),
}));

export const landmarkPhotoRelations = relations(landmarkPhoto, ({ one }) => ({
  landmark: one(landmark, {
    fields: [landmarkPhoto.landmarkId],
    references: [landmark.id],
  }),
}));

export const landmarkReviewRelations = relations(
  landmarkReview,
  ({ one }) => ({
    landmark: one(landmark, {
      fields: [landmarkReview.landmarkId],
      references: [landmark.id],
    }),
    user: one(user, {
      fields: [landmarkReview.userId],
      references: [user.id],
    }),
  }),
);

export const landmarkEditRelations = relations(
  landmarkEdit,
  ({ one }) => ({
    landmark: one(landmark, {
      fields: [landmarkEdit.landmarkId],
      references: [landmark.id],
    }),
    user: one(user, {
      fields: [landmarkEdit.userId],
      references: [user.id],
    }),
    reviewer: one(user, {
      fields: [landmarkEdit.reviewedBy],
      references: [user.id],
      relationName: "editReviewer",
    }),
  }),
);

export const communityPostRelations = relations(
  communityPost,
  ({ one, many }) => ({
    user: one(user, {
      fields: [communityPost.userId],
      references: [user.id],
    }),
    location: one(landmark, {
      fields: [communityPost.locationId],
      references: [landmark.id],
    }),
    event: one(campusEvent, {
      fields: [communityPost.eventId],
      references: [campusEvent.id],
    }),
    images: many(postImage),
    comments: many(postComment),
    votes: many(postVote),
    bookmarks: many(postBookmark),
  }),
);

export const postImageRelations = relations(postImage, ({ one }) => ({
  post: one(communityPost, {
    fields: [postImage.postId],
    references: [communityPost.id],
  }),
}));

export const postCommentRelations = relations(
  postComment,
  ({ one, many }) => ({
    post: one(communityPost, {
      fields: [postComment.postId],
      references: [communityPost.id],
    }),
    parent: one(postComment, {
      fields: [postComment.parentId],
      references: [postComment.id],
      relationName: "commentThread",
    }),
    replies: many(postComment, { relationName: "commentThread" }),
    user: one(user, {
      fields: [postComment.userId],
      references: [user.id],
    }),
    votes: many(commentVote),
  }),
);

export const postVoteRelations = relations(postVote, ({ one }) => ({
  post: one(communityPost, {
    fields: [postVote.postId],
    references: [communityPost.id],
  }),
  user: one(user, {
    fields: [postVote.userId],
    references: [user.id],
  }),
}));

export const commentVoteRelations = relations(commentVote, ({ one }) => ({
  comment: one(postComment, {
    fields: [commentVote.commentId],
    references: [postComment.id],
  }),
  user: one(user, {
    fields: [commentVote.userId],
    references: [user.id],
  }),
}));

export const postBookmarkRelations = relations(postBookmark, ({ one }) => ({
  post: one(communityPost, {
    fields: [postBookmark.postId],
    references: [communityPost.id],
  }),
  user: one(user, {
    fields: [postBookmark.userId],
    references: [user.id],
  }),
}));

export const campusEventRelations = relations(
  campusEvent,
  ({ one, many }) => ({
    user: one(user, {
      fields: [campusEvent.userId],
      references: [user.id],
    }),
    location: one(landmark, {
      fields: [campusEvent.locationId],
      references: [landmark.id],
    }),
    rsvps: many(eventRsvp),
    posts: many(communityPost),
  }),
);

export const eventRsvpRelations = relations(eventRsvp, ({ one }) => ({
  event: one(campusEvent, {
    fields: [eventRsvp.eventId],
    references: [campusEvent.id],
  }),
  user: one(user, {
    fields: [eventRsvp.userId],
    references: [user.id],
  }),
}));

export const gigListingRelations = relations(
  gigListing,
  ({ one, many }) => ({
    user: one(user, {
      fields: [gigListing.userId],
      references: [user.id],
    }),
    location: one(landmark, {
      fields: [gigListing.locationId],
      references: [landmark.id],
    }),
    swipes: many(gigSwipe),
  }),
);

export const gigSwipeRelations = relations(gigSwipe, ({ one }) => ({
  gig: one(gigListing, {
    fields: [gigSwipe.gigId],
    references: [gigListing.id],
  }),
  user: one(user, {
    fields: [gigSwipe.userId],
    references: [user.id],
  }),
}));

export const userNotificationRelations = relations(userNotification, ({ one }) => ({
  user: one(user, {
    fields: [userNotification.userId],
    references: [user.id],
  }),
}));

export const userNotificationSettingRelations = relations(userNotificationSetting, ({ one }) => ({
  user: one(user, {
    fields: [userNotificationSetting.userId],
    references: [user.id],
  }),
}));

export const userLegalConsentRelations = relations(userLegalConsent, ({ one }) => ({
  user: one(user, {
    fields: [userLegalConsent.userId],
    references: [user.id],
  }),
}));

export const userFollowRelations = relations(userFollow, ({ one }) => ({
  follower: one(user, {
    fields: [userFollow.followerId],
    references: [user.id],
    relationName: "follower",
  }),
  following: one(user, {
    fields: [userFollow.followingId],
    references: [user.id],
    relationName: "following",
  }),
}));

export const userPrivacySettingRelations = relations(userPrivacySetting, ({ one }) => ({
  user: one(user, {
    fields: [userPrivacySetting.userId],
    references: [user.id],
  }),
}));

// ─── Chat Relations ──────────────────────────────────────────────────────────

export const conversationRelations = relations(conversation, ({ many, one }) => ({
  participants: many(conversationParticipant),
  messages: many(message),
  request: one(messageRequest),
  deletedByUser: one(user, {
    fields: [conversation.deletedByUserId],
    references: [user.id],
    relationName: "conversationDeletedByUser",
  }),
}));

export const conversationParticipantRelations = relations(
  conversationParticipant,
  ({ one }) => ({
    conversation: one(conversation, {
      fields: [conversationParticipant.conversationId],
      references: [conversation.id],
    }),
    user: one(user, {
      fields: [conversationParticipant.userId],
      references: [user.id],
    }),
  }),
);

export const messageRelations = relations(message, ({ one }) => ({
  conversation: one(conversation, {
    fields: [message.conversationId],
    references: [conversation.id],
  }),
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
  }),
}));

export const messageRequestRelations = relations(messageRequest, ({ one }) => ({
  conversation: one(conversation, {
    fields: [messageRequest.conversationId],
    references: [conversation.id],
  }),
  fromUser: one(user, {
    fields: [messageRequest.fromUserId],
    references: [user.id],
    relationName: "requestFromUser",
  }),
  toUser: one(user, {
    fields: [messageRequest.toUserId],
    references: [user.id],
    relationName: "requestToUser",
  }),
}));

// ─── Border Relations ───────────────────────────────────────────────────────

export const userSelectedBorderRelations = relations(
  userSelectedBorder,
  ({ one }) => ({
    user: one(user, {
      fields: [userSelectedBorder.userId],
      references: [user.id],
    }),
  }),
);

export const userUnlockedBorderRelations = relations(
  userUnlockedBorder,
  ({ one }) => ({
    user: one(user, {
      fields: [userUnlockedBorder.userId],
      references: [user.id],
    }),
  }),
);

// ─── Flair Relations ─────────────────────────────────────────────────────────

export const userFlairRelations = relations(userFlair, ({ one }) => ({
  user: one(user, {
    fields: [userFlair.userId],
    references: [user.id],
  }),
}));

// ─── Campus Match Relations ─────────────────────────────────────────────────

export const cmPreferenceRelations = relations(cmPreference, ({ one }) => ({
  user: one(user, {
    fields: [cmPreference.userId],
    references: [user.id],
  }),
}));

export const cmQueueEntryRelations = relations(cmQueueEntry, ({ one }) => ({
  user: one(user, {
    fields: [cmQueueEntry.userId],
    references: [user.id],
  }),
}));

export const cmSessionRelations = relations(cmSession, ({ one, many }) => ({
  participants: many(cmSessionParticipant),
  messages: many(cmMessage),
  reports: many(cmReport),
  match: one(matchMatch),
  picSwaps: many(matchPicSwap),
}));

export const cmSessionParticipantRelations = relations(
  cmSessionParticipant,
  ({ one }) => ({
    session: one(cmSession, {
      fields: [cmSessionParticipant.sessionId],
      references: [cmSession.id],
    }),
    user: one(user, {
      fields: [cmSessionParticipant.userId],
      references: [user.id],
    }),
  }),
);

export const cmMessageRelations = relations(cmMessage, ({ one }) => ({
  session: one(cmSession, {
    fields: [cmMessage.sessionId],
    references: [cmSession.id],
  }),
  sender: one(user, {
    fields: [cmMessage.senderId],
    references: [user.id],
  }),
}));

export const cmReportRelations = relations(cmReport, ({ one }) => ({
  session: one(cmSession, {
    fields: [cmReport.sessionId],
    references: [cmSession.id],
  }),
  reporter: one(user, {
    fields: [cmReport.reporterId],
    references: [user.id],
    relationName: "reporter",
  }),
  reportedUser: one(user, {
    fields: [cmReport.reportedUserId],
    references: [user.id],
    relationName: "reportedUser",
  }),
  reviewer: one(user, {
    fields: [cmReport.reviewedBy],
    references: [user.id],
    relationName: "reviewer",
  }),
}));

export const cmBlockRelations = relations(cmBlock, ({ one }) => ({
  blocker: one(user, {
    fields: [cmBlock.blockerId],
    references: [user.id],
    relationName: "blocker",
  }),
  blocked: one(user, {
    fields: [cmBlock.blockedId],
    references: [user.id],
    relationName: "blocked",
  }),
}));

export const cmRematchCooldownRelations = relations(
  cmRematchCooldown,
  ({ one }) => ({
    userLow: one(user, {
      fields: [cmRematchCooldown.userIdLow],
      references: [user.id],
      relationName: "cooldownUserLow",
    }),
    userHigh: one(user, {
      fields: [cmRematchCooldown.userIdHigh],
      references: [user.id],
      relationName: "cooldownUserHigh",
    }),
  }),
);

export const cmBanRelations = relations(cmBan, ({ one }) => ({
  user: one(user, {
    fields: [cmBan.userId],
    references: [user.id],
    relationName: "bannedUser",
  }),
  sourceReport: one(cmReport, {
    fields: [cmBan.sourceReportId],
    references: [cmReport.id],
  }),
  createdByUser: one(user, {
    fields: [cmBan.createdBy],
    references: [user.id],
    relationName: "banCreator",
  }),
  liftedByUser: one(user, {
    fields: [cmBan.liftedBy],
    references: [user.id],
    relationName: "banLifter",
  }),
}));

// ─── Match Relations ─────────────────────────────────────────────────────────

export const matchPromptPoolRelations = relations(matchPromptPool, ({ many }) => ({
  profilePrompts: many(matchProfilePrompt),
}));

export const matchProfileRelations = relations(matchProfile, ({ one, many }) => ({
  user: one(user, {
    fields: [matchProfile.userId],
    references: [user.id],
  }),
  prompts: many(matchProfilePrompt),
  photos: many(matchProfilePhoto),
}));

export const matchProfilePhotoRelations = relations(matchProfilePhoto, ({ one }) => ({
  profile: one(matchProfile, {
    fields: [matchProfilePhoto.profileId],
    references: [matchProfile.id],
  }),
}));

export const matchProfilePromptRelations = relations(matchProfilePrompt, ({ one }) => ({
  profile: one(matchProfile, {
    fields: [matchProfilePrompt.profileId],
    references: [matchProfile.id],
  }),
  prompt: one(matchPromptPool, {
    fields: [matchProfilePrompt.promptId],
    references: [matchPromptPool.id],
  }),
}));

export const matchSwipeRelations = relations(matchSwipe, ({ one }) => ({
  swiper: one(user, {
    fields: [matchSwipe.swiperId],
    references: [user.id],
    relationName: "swiper",
  }),
  target: one(user, {
    fields: [matchSwipe.targetId],
    references: [user.id],
    relationName: "swipeTarget",
  }),
}));

export const matchMatchRelations = relations(matchMatch, ({ one }) => ({
  userA: one(user, {
    fields: [matchMatch.userIdA],
    references: [user.id],
    relationName: "matchUserA",
  }),
  userB: one(user, {
    fields: [matchMatch.userIdB],
    references: [user.id],
    relationName: "matchUserB",
  }),
  session: one(cmSession, {
    fields: [matchMatch.sessionId],
    references: [cmSession.id],
  }),
}));

export const matchPicSwapRelations = relations(matchPicSwap, ({ one }) => ({
  session: one(cmSession, {
    fields: [matchPicSwap.sessionId],
    references: [cmSession.id],
  }),
  initiator: one(user, {
    fields: [matchPicSwap.initiatorId],
    references: [user.id],
  }),
}));

// ─── Banner Relations ─────────────────────────────────────────────────────────

export const bannerRelations = relations(banner, ({ many }) => ({
  dismissals: many(bannerDismissal),
}));

export const bannerDismissalRelations = relations(bannerDismissal, ({ one }) => ({
  banner: one(banner, {
    fields: [bannerDismissal.bannerId],
    references: [banner.id],
  }),
  user: one(user, {
    fields: [bannerDismissal.userId],
    references: [user.id],
  }),
}));

// ─── Announcement Relations ───────────────────────────────────────────────────

export const announcementRelations = relations(announcement, ({ many }) => ({
  seenRecords: many(announcementSeen),
}));

export const announcementSeenRelations = relations(announcementSeen, ({ one }) => ({
  announcement: one(announcement, {
    fields: [announcementSeen.announcementId],
    references: [announcement.id],
  }),
  user: one(user, {
    fields: [announcementSeen.userId],
    references: [user.id],
  }),
}));
