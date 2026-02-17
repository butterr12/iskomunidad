import { landmarks, type Landmark } from "./landmarks";

export type GigCategory =
  | "tutoring"
  | "research"
  | "moving"
  | "event-staff"
  | "tech-help"
  | "food-delivery"
  | "errands"
  | "creative"
  | "other";

export type GigUrgency = "asap" | "this-week" | "flexible";
export type GigSortMode = "newest" | "pay" | "urgency";
export type SwipeAction = "saved" | "skipped" | null;

export interface GigListing {
  id: string;
  title: string;
  description: string;
  posterName: string;
  posterHandle: string;
  posterCollege?: string;
  compensation: string;
  compensationValue: number;
  isPaid: boolean;
  category: GigCategory;
  tags: string[];
  locationId?: string;
  locationNote?: string;
  createdAt: string;
  deadline?: string;
  urgency: GigUrgency;
  isOpen: boolean;
  applicantCount: number;
  swipeAction: SwipeAction;
  contactMethod: string;
  status?: "draft" | "approved" | "rejected";
  rejectionReason?: string;
}

export const CATEGORY_LABELS: Record<GigCategory, string> = {
  tutoring: "Tutoring",
  research: "Research",
  moving: "Moving",
  "event-staff": "Event Staff",
  "tech-help": "Tech Help",
  "food-delivery": "Food Delivery",
  errands: "Errands",
  creative: "Creative",
  other: "Other",
};

export const CATEGORY_COLORS: Record<GigCategory, string> = {
  tutoring: "#3b82f6",
  research: "#8b5cf6",
  moving: "#f59e0b",
  "event-staff": "#ec4899",
  "tech-help": "#06b6d4",
  "food-delivery": "#ef4444",
  errands: "#10b981",
  creative: "#f97316",
  other: "#6b7280",
};

export const GIG_CATEGORIES: GigCategory[] = [
  "tutoring",
  "research",
  "moving",
  "event-staff",
  "tech-help",
  "food-delivery",
  "errands",
  "creative",
  "other",
];

export const URGENCY_LABELS: Record<GigUrgency, string> = {
  asap: "ASAP",
  "this-week": "This Week",
  flexible: "Flexible",
};

export const URGENCY_COLORS: Record<GigUrgency, string> = {
  asap: "#ef4444",
  "this-week": "#f59e0b",
  flexible: "#10b981",
};

export function gigToLandmark(gig: GigListing): Landmark | null {
  if (!gig.locationId) return null;
  return landmarks.find((l) => l.id === gig.locationId) ?? null;
}

export function getGigsAtLandmark(landmarkId: string, gigs: GigListing[]): GigListing[] {
  return gigs.filter((g) => g.locationId === landmarkId);
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

const URGENCY_ORDER: Record<GigUrgency, number> = {
  asap: 0,
  "this-week": 1,
  flexible: 2,
};

export function sortGigs(gigs: GigListing[], mode: GigSortMode): GigListing[] {
  const sorted = [...gigs];
  switch (mode) {
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "pay":
      return sorted.sort((a, b) => b.compensationValue - a.compensationValue);
    case "urgency":
      return sorted.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
  }
}

// --- Mock Data ---

const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

export const mockGigs: GigListing[] = [
  {
    id: "gig-1",
    title: "Math 21 Tutor Needed",
    description:
      "Looking for someone who got at least 1.5 in Math 21 to tutor me 2x a week. I'm struggling with integrals and series. Willing to meet at the Main Lib or College of Science lobby. Flexible schedule, preferably afternoons.",
    posterName: "Ria Lim",
    posterHandle: "@rialim",
    posterCollege: "College of Social Sciences and Philosophy",
    compensation: "PHP 400/hr",
    compensationValue: 400,
    isPaid: true,
    category: "tutoring",
    tags: ["math", "calculus", "tutor"],
    locationId: "main-library",
    locationNote: "Main Library or CS Lobby",
    createdAt: h(2),
    deadline: new Date(now + 7 * 24 * 3600000).toISOString(),
    urgency: "this-week",
    isOpen: true,
    applicantCount: 3,
    swipeAction: null,
    contactMethod: "DM on app",
    status: "approved",
  },
  {
    id: "gig-2",
    title: "Research Assistant — NIMBB Lab",
    description:
      "The National Institute of Molecular Biology and Biotechnology is looking for an undergrad research assistant to help with data encoding, sample preparation, and literature review. Must be a Bio or Chem major. 10-15 hours per week. Great for students wanting research experience.",
    posterName: "Dr. Santos",
    posterHandle: "@drsantos",
    posterCollege: "College of Science",
    compensation: "PHP 5,000/mo",
    compensationValue: 5000,
    isPaid: true,
    category: "research",
    tags: ["biology", "lab", "research", "science"],
    locationId: "main-library",
    locationNote: "NIMBB Building, College of Science Complex",
    createdAt: h(8),
    deadline: new Date(now + 14 * 24 * 3600000).toISOString(),
    urgency: "this-week",
    isOpen: true,
    applicantCount: 7,
    swipeAction: null,
    contactMethod: "Email drsantos@up.edu.ph",
    status: "approved",
  },
  {
    id: "gig-3",
    title: "Help Me Move Out of Molave Dorm",
    description:
      "Moving out of Molave Residence Hall this Saturday. Need 2 people to help carry boxes and furniture to a UV Express going to Katipunan. Should take about 2-3 hours. Will provide lunch and pay.",
    posterName: "Marco Villa",
    posterHandle: "@marcovilla",
    compensation: "PHP 500 + lunch",
    compensationValue: 500,
    isPaid: true,
    category: "moving",
    tags: ["moving", "dorm", "physical"],
    locationNote: "Molave Residence Hall",
    createdAt: h(5),
    urgency: "asap",
    isOpen: true,
    applicantCount: 1,
    swipeAction: null,
    contactMethod: "DM on app",
    status: "approved",
  },
  {
    id: "gig-4",
    title: "UP Fair Booth Staff (3 nights)",
    description:
      "Our org needs 4 more volunteers to help run our food booth at UP Fair. Duties include serving, handling payments, and cleanup. You get free food, a fair shirt, and a great time. Feb 18-20, 5pm to midnight.",
    posterName: "UP Economics Society",
    posterHandle: "@upecon",
    posterCollege: "School of Economics",
    compensation: "Volunteer + free food & shirt",
    compensationValue: 0,
    isPaid: false,
    category: "event-staff",
    tags: ["UP Fair", "volunteer", "food", "event"],
    locationId: "sunken-garden",
    locationNote: "Sunken Garden, UP Fair Grounds",
    createdAt: h(12),
    deadline: new Date(now + 2 * 24 * 3600000).toISOString(),
    urgency: "asap",
    isOpen: true,
    applicantCount: 12,
    swipeAction: null,
    contactMethod: "DM @upecon on IG",
    status: "approved",
  },
  {
    id: "gig-5",
    title: "Fix Our Org Website (WordPress)",
    description:
      "Our org website is broken after a plugin update. Need someone who knows WordPress/PHP to fix the layout issues and update our events page. Should be a quick fix for someone experienced. Can meet to discuss or do it remotely.",
    posterName: "UP Mountaineers",
    posterHandle: "@upmountaineers",
    compensation: "PHP 1,500",
    compensationValue: 1500,
    isPaid: true,
    category: "tech-help",
    tags: ["wordpress", "web", "fix", "PHP"],
    createdAt: h(18),
    urgency: "this-week",
    isOpen: true,
    applicantCount: 2,
    swipeAction: null,
    contactMethod: "Email upmountaineers@gmail.com",
    status: "approved",
  },
  {
    id: "gig-6",
    title: "Food Delivery Runner — Area 2",
    description:
      "Small canteen near Area 2 looking for someone to deliver lunch orders to nearby buildings (CSSP, CMC, Palma Hall) from 11am-1pm on weekdays. Bike or on foot. Tips from customers are yours to keep.",
    posterName: "Ate Nene's Carinderia",
    posterHandle: "@atenene",
    compensation: "PHP 200/day + tips",
    compensationValue: 200,
    isPaid: true,
    category: "food-delivery",
    tags: ["delivery", "food", "part-time", "daily"],
    locationId: "as-steps",
    locationNote: "Area 2, near CSSP",
    createdAt: h(24),
    urgency: "flexible",
    isOpen: true,
    applicantCount: 4,
    swipeAction: null,
    contactMethod: "Visit the carinderia or text 0917-XXX-XXXX",
    status: "approved",
  },
  {
    id: "gig-7",
    title: "Photocopy & Bind My Thesis",
    description:
      "Need someone to photocopy and spiral-bind 5 copies of my thesis (around 120 pages each) at the Shopping Center or any nearby print shop. I'm swamped with revisions and can't go myself. Will pay for copies + service fee.",
    posterName: "Nate Flores",
    posterHandle: "@nateflores",
    compensation: "PHP 300 service fee",
    compensationValue: 300,
    isPaid: true,
    category: "errands",
    tags: ["printing", "thesis", "errand"],
    locationNote: "UP Shopping Center",
    createdAt: h(3),
    urgency: "asap",
    isOpen: true,
    applicantCount: 0,
    swipeAction: null,
    contactMethod: "DM on app",
    status: "approved",
  },
  {
    id: "gig-8",
    title: "Design Our CS Guild Shirt",
    description:
      "UP Computer Science Guild is looking for a student artist/designer to create our org shirt design for this academic year. Theme: 'Code the Future'. We need front and back designs, print-ready files. Portfolio required.",
    posterName: "CS Guild",
    posterHandle: "@csguild",
    posterCollege: "Department of Computer Science",
    compensation: "PHP 3,000",
    compensationValue: 3000,
    isPaid: true,
    category: "creative",
    tags: ["design", "art", "shirt", "graphic design"],
    createdAt: h(36),
    deadline: new Date(now + 21 * 24 * 3600000).toISOString(),
    urgency: "flexible",
    isOpen: true,
    applicantCount: 5,
    swipeAction: null,
    contactMethod: "Submit portfolio to csguild@up.edu.ph",
    status: "approved",
  },
  {
    id: "gig-9",
    title: "Filipino Language Tutor for Exchange Student",
    description:
      "Hi! I'm an exchange student from Sweden studying at UP for one semester. Looking for a patient Filipino tutor to help me learn conversational Tagalog. 2-3 sessions per week, 1 hour each. Happy to meet anywhere on campus.",
    posterName: "Erik Lindberg",
    posterHandle: "@eriklindberg",
    compensation: "PHP 350/hr",
    compensationValue: 350,
    isPaid: true,
    category: "tutoring",
    tags: ["Filipino", "Tagalog", "language", "tutor"],
    locationId: "sunken-garden",
    locationNote: "Anywhere on campus",
    createdAt: h(15),
    urgency: "flexible",
    isOpen: true,
    applicantCount: 8,
    swipeAction: null,
    contactMethod: "DM on app",
    status: "approved",
  },
  {
    id: "gig-10",
    title: "Philo 1 Note-Taker Needed",
    description:
      "I have a scheduling conflict with my Philo 1 class (TTh 10-11:30am, Palma Hall 401). Need someone who's also in the class to share detailed notes with me each session. Will pay per week. Must have good handwriting or typed notes.",
    posterName: "Ana Garcia",
    posterHandle: "@anagarcia",
    posterCollege: "College of Engineering",
    compensation: "PHP 200/week",
    compensationValue: 200,
    isPaid: true,
    category: "other",
    tags: ["notes", "philosophy", "class"],
    locationId: "as-steps",
    locationNote: "Palma Hall 401",
    createdAt: h(10),
    urgency: "this-week",
    isOpen: true,
    applicantCount: 2,
    swipeAction: null,
    contactMethod: "DM on app",
    status: "approved",
  },
  // Draft gig (pending moderation)
  {
    id: "gig-11",
    title: "Need Someone to Take My Exam",
    description: "Will pay well. DM for details.",
    posterName: "Shady Student",
    posterHandle: "@shadystudent",
    compensation: "PHP 5,000",
    compensationValue: 5000,
    isPaid: true,
    category: "other",
    tags: ["exam"],
    createdAt: h(1),
    urgency: "asap",
    isOpen: true,
    applicantCount: 0,
    swipeAction: null,
    contactMethod: "DM on app",
    status: "draft",
  },
  // Rejected gig
  {
    id: "gig-12",
    title: "MLM Opportunity — Be Your Own Boss!!!",
    description: "Join our team and earn unlimited income! No experience needed.",
    posterName: "Boss Babe",
    posterHandle: "@bossbabe",
    compensation: "Unlimited potential",
    compensationValue: 0,
    isPaid: false,
    category: "other",
    tags: ["mlm", "scam"],
    createdAt: h(48),
    urgency: "flexible",
    isOpen: false,
    applicantCount: 0,
    swipeAction: null,
    contactMethod: "DM on app",
    status: "rejected",
    rejectionReason: "Post appears to be a multi-level marketing scheme and violates community guidelines.",
  },
];
