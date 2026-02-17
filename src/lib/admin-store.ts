import { mockPosts, type CommunityPost, type PostStatus } from "./posts";
import { mockEvents, type CampusEvent } from "./events";
import { landmarks as rawLandmarks, type Landmark } from "./landmarks";
import { mockGigs, type GigListing } from "./gigs";

export interface AdminNotification {
  id: string;
  type: "approved" | "rejected" | "event_approved" | "event_rejected" | "location_approved" | "location_rejected" | "gig_approved" | "gig_rejected";
  postId: string;
  postTitle: string;
  authorHandle: string;
  reason?: string;
  createdAt: string;
  readByAdmin: boolean;
}

export interface AdminSettings {
  autoApprove: boolean;
}

// --- Module-level mutable state (singleton) ---

let posts: CommunityPost[] = mockPosts.map((p) => ({
  ...p,
  status: p.status ?? ("approved" as PostStatus),
}));

let events: CampusEvent[] = mockEvents.map((e) => ({
  ...e,
  status: e.status ?? "approved",
}));

let landmarksList: Landmark[] = rawLandmarks.map((l) => ({
  ...l,
  status: l.status ?? "approved",
}));

let gigs: GigListing[] = mockGigs.map((g) => ({
  ...g,
  status: g.status ?? "approved",
}));

let notifications: AdminNotification[] = [
  {
    id: "notif-1",
    type: "approved",
    postId: "post-4",
    postTitle: "What happened at the AS Steps rally today?",
    authorHandle: "@pedroreyes",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    readByAdmin: true,
  },
  {
    id: "notif-2",
    type: "rejected",
    postId: "post-19",
    postTitle: "Buy my stuff ASAP!!!",
    authorHandle: "@totallynotspam",
    reason: "Post appears to be spam. Please follow community guidelines.",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    readByAdmin: false,
  },
];

let settings: AdminSettings = {
  autoApprove: true,
};

let nextNotifId = 3;

// --- Accessors ---

export function getPosts(): CommunityPost[] {
  return posts;
}

export function getEvents(): CampusEvent[] {
  return events;
}

export function getLandmarks(): Landmark[] {
  return landmarksList;
}

export function getGigs(): GigListing[] {
  return gigs;
}

export function getNotifications(): AdminNotification[] {
  return notifications;
}

export function getSettings(): AdminSettings {
  return { ...settings };
}

// --- Post Mutations ---

export function approvePost(id: string): void {
  posts = posts.map((p) =>
    p.id === id ? { ...p, status: "approved" as PostStatus, rejectionReason: undefined } : p
  );
  const post = posts.find((p) => p.id === id);
  if (post) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "approved",
        postId: post.id,
        postTitle: post.title,
        authorHandle: post.authorHandle,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function rejectPost(id: string, reason: string): void {
  posts = posts.map((p) =>
    p.id === id ? { ...p, status: "rejected" as PostStatus, rejectionReason: reason } : p
  );
  const post = posts.find((p) => p.id === id);
  if (post) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "rejected",
        postId: post.id,
        postTitle: post.title,
        authorHandle: post.authorHandle,
        reason,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function createPost(post: Omit<CommunityPost, "id" | "score" | "commentCount" | "userVote" | "createdAt" | "status">): CommunityPost {
  const newPost: CommunityPost = {
    ...post,
    id: `post-${Date.now()}`,
    score: 0,
    commentCount: 0,
    userVote: 0,
    createdAt: new Date().toISOString(),
    status: settings.autoApprove ? "approved" : "draft",
  };
  posts = [newPost, ...posts];
  return newPost;
}

export function deletePost(id: string): void {
  posts = posts.filter((p) => p.id !== id);
}

// --- Event Mutations ---

export function approveEvent(id: string): void {
  events = events.map((e) =>
    e.id === id ? { ...e, status: "approved" as const, rejectionReason: undefined } : e
  );
  const event = events.find((e) => e.id === id);
  if (event) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "event_approved",
        postId: event.id,
        postTitle: event.title,
        authorHandle: event.organizer,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function rejectEvent(id: string, reason: string): void {
  events = events.map((e) =>
    e.id === id ? { ...e, status: "rejected" as const, rejectionReason: reason } : e
  );
  const event = events.find((e) => e.id === id);
  if (event) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "event_rejected",
        postId: event.id,
        postTitle: event.title,
        authorHandle: event.organizer,
        reason,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function createEvent(event: Omit<CampusEvent, "id" | "attendeeCount" | "interestedCount" | "rsvpStatus" | "status">): CampusEvent {
  const newEvent: CampusEvent = {
    ...event,
    id: `event-${Date.now()}`,
    attendeeCount: 0,
    interestedCount: 0,
    rsvpStatus: null,
    status: settings.autoApprove ? "approved" : "draft",
  };
  events = [newEvent, ...events];
  return newEvent;
}

export function deleteEvent(id: string): void {
  events = events.filter((e) => e.id !== id);
}

// --- Landmark Mutations ---

export function approveLandmark(id: string): void {
  landmarksList = landmarksList.map((l) =>
    l.id === id ? { ...l, status: "approved" as const, rejectionReason: undefined } : l
  );
  const landmark = landmarksList.find((l) => l.id === id);
  if (landmark) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "location_approved",
        postId: landmark.id,
        postTitle: landmark.name,
        authorHandle: "System",
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function rejectLandmark(id: string, reason: string): void {
  landmarksList = landmarksList.map((l) =>
    l.id === id ? { ...l, status: "rejected" as const, rejectionReason: reason } : l
  );
  const landmark = landmarksList.find((l) => l.id === id);
  if (landmark) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "location_rejected",
        postId: landmark.id,
        postTitle: landmark.name,
        authorHandle: "System",
        reason,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function createLandmark(landmark: Omit<Landmark, "id" | "status">): Landmark {
  const newLandmark: Landmark = {
    ...landmark,
    id: `landmark-${Date.now()}`,
    status: settings.autoApprove ? "approved" : "draft",
  };
  landmarksList = [newLandmark, ...landmarksList];
  return newLandmark;
}

export function deleteLandmark(id: string): void {
  landmarksList = landmarksList.filter((l) => l.id !== id);
}

// --- Gig Mutations ---

export function approveGig(id: string): void {
  gigs = gigs.map((g) =>
    g.id === id ? { ...g, status: "approved" as const, rejectionReason: undefined } : g
  );
  const gig = gigs.find((g) => g.id === id);
  if (gig) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "gig_approved",
        postId: gig.id,
        postTitle: gig.title,
        authorHandle: gig.posterHandle,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function rejectGig(id: string, reason: string): void {
  gigs = gigs.map((g) =>
    g.id === id ? { ...g, status: "rejected" as const, rejectionReason: reason } : g
  );
  const gig = gigs.find((g) => g.id === id);
  if (gig) {
    notifications = [
      {
        id: `notif-${nextNotifId++}`,
        type: "gig_rejected",
        postId: gig.id,
        postTitle: gig.title,
        authorHandle: gig.posterHandle,
        reason,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
      },
      ...notifications,
    ];
  }
}

export function createGig(gig: Omit<GigListing, "id" | "applicantCount" | "swipeAction" | "status">): GigListing {
  const newGig: GigListing = {
    ...gig,
    id: `gig-${Date.now()}`,
    applicantCount: 0,
    swipeAction: null,
    status: settings.autoApprove ? "approved" : "draft",
  };
  gigs = [newGig, ...gigs];
  return newGig;
}

export function deleteGig(id: string): void {
  gigs = gigs.filter((g) => g.id !== id);
}

// --- Settings & Notifications ---

export function setSettings(s: Partial<AdminSettings>): void {
  settings = { ...settings, ...s };
}

export function markAllNotificationsRead(): void {
  notifications = notifications.map((n) => ({ ...n, readByAdmin: true }));
}
