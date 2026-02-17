import type { Landmark } from "./landmarks";

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

export type GigUrgency = "flexible" | "soon" | "urgent";
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
  urgent: "Urgent",
  soon: "This Week",
  flexible: "Flexible",
};

export const URGENCY_COLORS: Record<GigUrgency, string> = {
  urgent: "#ef4444",
  soon: "#f59e0b",
  flexible: "#10b981",
};

export function gigToLandmark(gig: GigListing, landmarks: Landmark[]): Landmark | null {
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
  urgent: 0,
  soon: 1,
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

export function parseCompensation(text: string): { value: number; isPaid: boolean } {
  const lower = text.toLowerCase().trim();

  const unpaidKeywords = ["volunteer", "voluntary", "free", "pro bono", "unpaid", "no pay"];
  if (unpaidKeywords.some((kw) => lower.includes(kw))) {
    return { value: 0, isPaid: false };
  }

  // Extract first number: handles ₱500, PHP 1,500, P300, 500.00
  const numMatch = lower.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  const value = numMatch ? Math.round(parseFloat(numMatch[1])) : 0;

  return { value, isPaid: true };
}
