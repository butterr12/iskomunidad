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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user, session, account } from "./auth-schema";

// Re-export auth tables so everything is accessible from one place
export { user, session, account, verification } from "./auth-schema";

// ─── Landmark ──────────────────────────────────────────────────────────────────

export const landmark = pgTable("landmark", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // "attraction" | "community" | "event"
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
});

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

// ─── Community Post ────────────────────────────────────────────────────────────

export const communityPost = pgTable("community_post", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type").notNull(), // "text" | "link" | "image"
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  flair: text("flair").notNull(), // "Discussion" | "Question" | etc.
  locationId: uuid("location_id").references(() => landmark.id, {
    onDelete: "set null",
  }),
  score: integer("score").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  linkUrl: text("link_url"),
  imageColor: text("image_color"),
  imageEmoji: text("image_emoji"),
  status: text("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
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
  attendeeCount: integer("attendee_count").notNull().default(0),
  interestedCount: integer("interested_count").notNull().default(0),
  status: text("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

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
});

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
});

// ─── Relations ─────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  landmarks: many(landmark),
  landmarkReviews: many(landmarkReview),
  communityPosts: many(communityPost),
  postComments: many(postComment),
  postVotes: many(postVote),
  commentVotes: many(commentVote),
  campusEvents: many(campusEvent),
  eventRsvps: many(eventRsvp),
  gigListings: many(gigListing),
  gigSwipes: many(gigSwipe),
  userNotifications: many(userNotification),
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

export const landmarkRelations = relations(landmark, ({ one, many }) => ({
  user: one(user, {
    fields: [landmark.userId],
    references: [user.id],
  }),
  photos: many(landmarkPhoto),
  reviews: many(landmarkReview),
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
    comments: many(postComment),
    votes: many(postVote),
  }),
);

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
