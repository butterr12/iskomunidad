import { landmarks, type Landmark } from "./landmarks";

export type PostType = "text" | "link" | "image";
export type PostFlair = "Discussion" | "Question" | "Selling" | "Announcement" | "Meme" | "Help" | "Rant";
export type PostStatus = "draft" | "approved" | "rejected";
export type VoteDirection = 1 | -1 | 0;
export type SortMode = "hot" | "new" | "top";

export interface CommunityPost {
  id: string;
  title: string;
  body?: string;
  type: PostType;
  author: string;
  authorHandle: string;
  flair: PostFlair;
  locationId?: string;
  createdAt: string;
  score: number;
  commentCount: number;
  userVote: VoteDirection;
  linkUrl?: string;
  imageColor?: string;
  imageEmoji?: string;
  status?: PostStatus;
  rejectionReason?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  authorHandle: string;
  body: string;
  createdAt: string;
  score: number;
  userVote: VoteDirection;
}

export interface CommentNode {
  comment: PostComment;
  children: CommentNode[];
}

export const POST_FLAIRS: PostFlair[] = [
  "Discussion",
  "Question",
  "Selling",
  "Announcement",
  "Meme",
  "Help",
  "Rant",
];

export const FLAIR_COLORS: Record<PostFlair, string> = {
  Discussion: "#3b82f6",
  Question: "#8b5cf6",
  Selling: "#10b981",
  Announcement: "#f59e0b",
  Meme: "#ec4899",
  Help: "#06b6d4",
  Rant: "#ef4444",
};

export function postToLandmark(post: CommunityPost): Landmark | null {
  if (!post.locationId) return null;
  return landmarks.find((l) => l.id === post.locationId) ?? null;
}

export function getPostsAtLandmark(landmarkId: string, posts: CommunityPost[]): CommunityPost[] {
  return posts.filter((p) => p.locationId === landmarkId);
}

export function buildCommentTree(comments: PostComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    map.set(comment.id, { comment, children: [] });
  }

  for (const comment of comments) {
    const node = map.get(comment.id)!;
    if (comment.parentId) {
      const parent = map.get(comment.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function getCommentsForPost(postId: string): PostComment[] {
  return mockComments.filter((c) => c.postId === postId);
}

export function hotScore(post: CommunityPost): number {
  const hoursAge = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
  return post.score / Math.pow(hoursAge + 2, 1.5);
}

export function sortPosts(posts: CommunityPost[], mode: SortMode): CommunityPost[] {
  const sorted = [...posts];
  switch (mode) {
    case "hot":
      return sorted.sort((a, b) => hotScore(b) - hotScore(a));
    case "new":
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "top":
      return sorted.sort((a, b) => b.score - a.score);
  }
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

// --- Mock Data ---

const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

export const mockPosts: CommunityPost[] = [
  {
    id: "post-1",
    title: "Best study spots that are NOT the Main Lib?",
    body: "Any recommendations? The Main Library is always packed during midterms. Looking for somewhere quiet with outlets and decent WiFi.",
    type: "text",
    author: "Juan Dela Cruz",
    authorHandle: "@juandelacruz",
    flair: "Question",
    locationId: "main-library",
    createdAt: h(2),
    score: 42,
    commentCount: 4,
    userVote: 0,
  },
  {
    id: "post-2",
    title: "Sunken Garden at 12pm vs 12:01pm",
    body: "The sun hits different in UP.",
    type: "image",
    author: "Maria Santos",
    authorHandle: "@mariasantos",
    flair: "Meme",
    locationId: "sunken-garden",
    createdAt: h(4),
    score: 128,
    commentCount: 3,
    userVote: 1,
    imageColor: "#fbbf24",
    imageEmoji: "☀️",
  },
  {
    id: "post-3",
    title: "New enrollment procedures for 2nd sem",
    body: "Important changes to the enrollment process. Read the full advisory here.",
    type: "link",
    author: "UP Registrar",
    authorHandle: "@upregistrar",
    flair: "Announcement",
    locationId: "quezon-hall",
    createdAt: h(6),
    score: 87,
    commentCount: 2,
    userVote: 0,
    linkUrl: "https://up.edu.ph/enrollment-advisory-2026",
  },
  {
    id: "post-4",
    title: "What happened at the AS Steps rally today?",
    body: "I saw a huge crowd at the AS Steps around 3pm. Does anyone know what the rally was about? I could hear chanting from Palma Hall.",
    type: "text",
    author: "Pedro Reyes",
    authorHandle: "@pedroreyes",
    flair: "Discussion",
    locationId: "as-steps",
    createdAt: h(1),
    score: 56,
    commentCount: 5,
    userVote: 0,
  },
  {
    id: "post-5",
    title: "Selling Org Sci textbook (barely used)",
    body: "Selling my Org Sci textbook for PHP 350. Barely used, no highlights. DM me if interested. Can meet up near AS or Shopping Center.",
    type: "text",
    author: "Ana Garcia",
    authorHandle: "@anagarcia",
    flair: "Selling",
    createdAt: h(8),
    score: 12,
    commentCount: 1,
    userVote: 0,
  },
  {
    id: "post-6",
    title: "Me walking past the Oblation during finals week",
    body: "Same energy tbh.",
    type: "image",
    author: "Luis Mendoza",
    authorHandle: "@luismendoza",
    flair: "Meme",
    locationId: "oblation",
    createdAt: h(3),
    score: 203,
    commentCount: 2,
    userVote: 0,
    imageColor: "#a78bfa",
    imageEmoji: "😭",
  },
  {
    id: "post-7",
    title: "How to apply for student financial assistance",
    body: "Step-by-step guide for SFA applications.",
    type: "link",
    author: "UP OSA",
    authorHandle: "@uposa",
    flair: "Help",
    createdAt: h(12),
    score: 65,
    commentCount: 0,
    userVote: 0,
    linkUrl: "https://osa.up.edu.ph/financial-assistance",
  },
  {
    id: "post-8",
    title: "Why is the CRS always down during enrollment?",
    body: "Every single enrollment period, CRS crashes. It's 2026 and we still can't enroll without staying up until 3am. The servers can't handle the load and the waitlist system is broken. Anyone else frustrated?",
    type: "text",
    author: "Carlo Tan",
    authorHandle: "@carlotan",
    flair: "Rant",
    createdAt: h(5),
    score: 156,
    commentCount: 5,
    userVote: 1,
  },
  {
    id: "post-9",
    title: "UP Lagoon cleanup volunteers needed this Saturday",
    body: "We're organizing a lagoon cleanup this Saturday at 7am. Bring gloves if you have them. Free snacks for volunteers!",
    type: "text",
    author: "Green UP",
    authorHandle: "@greenup",
    flair: "Discussion",
    locationId: "lagoon",
    createdAt: h(10),
    score: 34,
    commentCount: 0,
    userVote: 0,
  },
  {
    id: "post-10",
    title: "The Carillon at golden hour",
    body: "Caught this view earlier today. UP is beautiful.",
    type: "image",
    author: "Sofia Cruz",
    authorHandle: "@sofiacruz",
    flair: "Discussion",
    locationId: "carillon",
    createdAt: h(7),
    score: 89,
    commentCount: 0,
    userVote: 0,
    imageColor: "#f97316",
    imageEmoji: "🔔",
  },
  {
    id: "post-11",
    title: "Any orgs for freshies interested in debate?",
    body: "I'm a freshie from Pol Sci and I want to join a debate org. Which ones are accepting applicants this sem?",
    type: "text",
    author: "Ria Lim",
    authorHandle: "@rialim",
    flair: "Question",
    createdAt: h(14),
    score: 18,
    commentCount: 0,
    userVote: 0,
  },
  {
    id: "post-12",
    title: "Intramurals 2026 schedule released",
    body: "Full schedule of events for this year's intramurals.",
    type: "link",
    author: "UP Sports",
    authorHandle: "@upsports",
    flair: "Announcement",
    locationId: "sunken-garden",
    createdAt: h(18),
    score: 45,
    commentCount: 0,
    userVote: 0,
    linkUrl: "https://upsports.up.edu.ph/intramurals-2026",
  },
  {
    id: "post-13",
    title: "Looking for roommate near campus, 5k/mo",
    body: "Looking for a roommate to share a 2BR apartment along Katipunan. Rent is PHP 10k total, split 5k each. Available starting March. Preferably a UP student.",
    type: "text",
    author: "Marco Villa",
    authorHandle: "@marcovilla",
    flair: "Selling",
    createdAt: h(20),
    score: 22,
    commentCount: 0,
    userVote: 0,
  },
  {
    id: "post-14",
    title: "Lost my ID at the Main Library, pls help",
    body: "I think I left my UP ID at the 3rd floor reading area around 2pm today. If anyone found it please DM me. Name on the ID: J. Ramos.",
    type: "text",
    author: "Jay Ramos",
    authorHandle: "@jayramos",
    flair: "Help",
    locationId: "main-library",
    createdAt: h(1.5),
    score: 8,
    commentCount: 0,
    userVote: 0,
  },
  {
    id: "post-15",
    title: "POV: You're running to catch the Ikot jeep",
    body: "Every. Single. Day.",
    type: "image",
    author: "Bea Torres",
    authorHandle: "@beatorres",
    flair: "Meme",
    createdAt: h(9),
    score: 175,
    commentCount: 0,
    userVote: 0,
    imageColor: "#34d399",
    imageEmoji: "🏃",
  },
  // Draft posts (pending moderation)
  {
    id: "post-16",
    title: "Free tutoring sessions for Math 21 this week",
    body: "Hey everyone! I'm offering free tutoring sessions for Math 21 at the College of Science lobby. Tuesdays and Thursdays, 4-6pm. DM me to reserve a slot.",
    type: "text",
    author: "Kim Reyes",
    authorHandle: "@kimreyes",
    flair: "Help",
    locationId: "main-library",
    createdAt: h(0.5),
    score: 0,
    commentCount: 0,
    userVote: 0,
    status: "draft",
  },
  {
    id: "post-17",
    title: "Anyone know where to get cheap printing near campus?",
    body: "Need to print my thesis draft (200+ pages). Looking for the most affordable printing shop around Katipunan or inside campus.",
    type: "text",
    author: "Nate Flores",
    authorHandle: "@nateflores",
    flair: "Question",
    createdAt: h(0.3),
    score: 0,
    commentCount: 0,
    userVote: 0,
    status: "draft",
  },
  {
    id: "post-18",
    title: "UP Fair 2026 lineup leaked?!",
    body: "Check this link for the rumored lineup. Not confirmed yet but looks legit!",
    type: "link",
    author: "Event Insider",
    authorHandle: "@eventinsider",
    flair: "Discussion",
    locationId: "sunken-garden",
    createdAt: h(0.2),
    score: 0,
    commentCount: 0,
    userVote: 0,
    linkUrl: "https://example.com/upfair2026",
    status: "draft",
  },
  // Rejected posts
  {
    id: "post-19",
    title: "Buy my stuff ASAP!!!",
    body: "SELLING EVERYTHING. CHECK MY PAGE FOR DEALS.",
    type: "text",
    author: "Spam Account",
    authorHandle: "@totallynotspam",
    flair: "Selling",
    createdAt: h(15),
    score: 0,
    commentCount: 0,
    userVote: 0,
    status: "rejected",
    rejectionReason: "Post appears to be spam. Please follow community guidelines.",
  },
  {
    id: "post-20",
    title: "This campus is the worst",
    body: "Content removed for violating community guidelines.",
    type: "text",
    author: "Angry Student",
    authorHandle: "@angrystudent",
    flair: "Rant",
    createdAt: h(22),
    score: 0,
    commentCount: 0,
    userVote: 0,
    status: "rejected",
    rejectionReason: "Post contains inappropriate language and violates community standards.",
  },
];

export const mockComments: PostComment[] = [
  // Post 1: "Best study spots" — 4 threaded comments
  {
    id: "c1-1",
    postId: "post-1",
    parentId: null,
    author: "Study Buddy",
    authorHandle: "@studybuddy",
    body: "Try the College of Law library. It's usually quieter and has great AC.",
    createdAt: h(1),
    score: 12,
    userVote: 0,
  },
  {
    id: "c1-2",
    postId: "post-1",
    parentId: "c1-1",
    author: "Juan Dela Cruz",
    authorHandle: "@juandelacruz",
    body: "Thanks! Do they let non-Law students in?",
    createdAt: h(0.75),
    score: 3,
    userVote: 0,
  },
  {
    id: "c1-3",
    postId: "post-1",
    parentId: "c1-2",
    author: "Study Buddy",
    authorHandle: "@studybuddy",
    body: "Yes, just bring your UP ID. They check at the entrance.",
    createdAt: h(0.5),
    score: 5,
    userVote: 0,
  },
  {
    id: "c1-4",
    postId: "post-1",
    parentId: null,
    author: "Cafe Lover",
    authorHandle: "@cafelover",
    body: "The area near CASAA has some nice coffee shops with WiFi. Not as quiet but good vibes.",
    createdAt: h(1.5),
    score: 8,
    userVote: 0,
  },

  // Post 2: "Sunken Garden 12pm" — 3 threaded comments
  {
    id: "c2-1",
    postId: "post-2",
    parentId: null,
    author: "Derecho Kid",
    authorHandle: "@derechokid",
    body: "ACCURATE. One minute you're enjoying the breeze, next you're melting.",
    createdAt: h(3.5),
    score: 24,
    userVote: 0,
  },
  {
    id: "c2-2",
    postId: "post-2",
    parentId: "c2-1",
    author: "Maria Santos",
    authorHandle: "@mariasantos",
    body: "The UV index at noon is no joke fr fr",
    createdAt: h(3),
    score: 15,
    userVote: 0,
  },
  {
    id: "c2-3",
    postId: "post-2",
    parentId: null,
    author: "Sunflower",
    authorHandle: "@sunflower",
    body: "This is why I only cross Sunken Garden at 6pm lol",
    createdAt: h(2),
    score: 9,
    userVote: 0,
  },

  // Post 3: "Enrollment procedures" — 2 flat comments
  {
    id: "c3-1",
    postId: "post-3",
    parentId: null,
    author: "Freshie 2026",
    authorHandle: "@freshie2026",
    body: "Thank you for sharing! Does this apply to transferees too?",
    createdAt: h(5),
    score: 4,
    userVote: 0,
  },
  {
    id: "c3-2",
    postId: "post-3",
    parentId: null,
    author: "Senior Na",
    authorHandle: "@seniorna",
    body: "Finally, a clearer process. The old one was so confusing.",
    createdAt: h(4.5),
    score: 7,
    userVote: 0,
  },

  // Post 4: "AS Steps rally" — 5 threaded comments
  {
    id: "c4-1",
    postId: "post-4",
    parentId: null,
    author: "Isko Activist",
    authorHandle: "@iskoactivist",
    body: "It was about the proposed tuition increase. USC organized it.",
    createdAt: h(0.8),
    score: 18,
    userVote: 0,
  },
  {
    id: "c4-2",
    postId: "post-4",
    parentId: "c4-1",
    author: "Pedro Reyes",
    authorHandle: "@pedroreyes",
    body: "Oh no, another tuition increase? What are the details?",
    createdAt: h(0.6),
    score: 6,
    userVote: 0,
  },
  {
    id: "c4-3",
    postId: "post-4",
    parentId: "c4-2",
    author: "Isko Activist",
    authorHandle: "@iskoactivist",
    body: "They're proposing a 10% increase starting next AY. Check USC's page for the full breakdown.",
    createdAt: h(0.4),
    score: 10,
    userVote: 0,
  },
  {
    id: "c4-4",
    postId: "post-4",
    parentId: null,
    author: "Observer",
    authorHandle: "@observer",
    body: "The turnout was massive. I think over 500 students showed up.",
    createdAt: h(0.5),
    score: 14,
    userVote: 0,
  },
  {
    id: "c4-5",
    postId: "post-4",
    parentId: "c4-4",
    author: "Campus Times",
    authorHandle: "@campustimes",
    body: "We estimated around 700 students based on our photos. Article coming out tomorrow.",
    createdAt: h(0.3),
    score: 20,
    userVote: 0,
  },

  // Post 5: "Selling textbook" — 1 flat comment
  {
    id: "c5-1",
    postId: "post-5",
    parentId: null,
    author: "Bargain Hunter",
    authorHandle: "@bargainhunter",
    body: "Is this still available? Can you do 300?",
    createdAt: h(7),
    score: 2,
    userVote: 0,
  },

  // Post 6: "Oblation finals" — 2 flat comments
  {
    id: "c6-1",
    postId: "post-6",
    parentId: null,
    author: "Finals Survivor",
    authorHandle: "@finalssurvivor",
    body: "The Oblation is all of us during finals szn 😂",
    createdAt: h(2.5),
    score: 31,
    userVote: 0,
  },
  {
    id: "c6-2",
    postId: "post-6",
    parentId: null,
    author: "Art Major",
    authorHandle: "@artmajor",
    body: "At least the Oblation has freedom. We have problem sets.",
    createdAt: h(2),
    score: 19,
    userVote: 0,
  },

  // Post 8: "CRS always down" — 5 threaded comments
  {
    id: "c8-1",
    postId: "post-8",
    parentId: null,
    author: "CS Student",
    authorHandle: "@csstudent",
    body: "As a CS major, the architecture of CRS makes me cry. They need to modernize the whole stack.",
    createdAt: h(4.5),
    score: 42,
    userVote: 0,
  },
  {
    id: "c8-2",
    postId: "post-8",
    parentId: "c8-1",
    author: "Carlo Tan",
    authorHandle: "@carlotan",
    body: "Right? Even just proper load balancing would help.",
    createdAt: h(4),
    score: 15,
    userVote: 0,
  },
  {
    id: "c8-3",
    postId: "post-8",
    parentId: "c8-2",
    author: "CS Student",
    authorHandle: "@csstudent",
    body: "I heard they're working on a new system but it's been 'in development' for 3 years now.",
    createdAt: h(3.5),
    score: 22,
    userVote: 0,
  },
  {
    id: "c8-4",
    postId: "post-8",
    parentId: null,
    author: "Enrollment Veteran",
    authorHandle: "@enrollmentveteran",
    body: "Pro tip: Try enrolling at exactly 12:01 AM. The servers are slightly less loaded right when they open.",
    createdAt: h(4),
    score: 28,
    userVote: 0,
  },
  {
    id: "c8-5",
    postId: "post-8",
    parentId: "c8-4",
    author: "Night Owl",
    authorHandle: "@nightowl",
    body: "Can confirm. Got all my classes in 10 minutes last sem doing this.",
    createdAt: h(3),
    score: 11,
    userVote: 0,
  },
];
