export type EventCategory = "academic" | "cultural" | "social" | "sports" | "org";
export type RsvpStatus = "going" | "interested" | null;

export interface CampusEvent {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: EventCategory;
  organizer: string;
  startDate: string;
  endDate: string;
  locationId?: string;
  tags: string[];
  coverColor: string;
  attendeeCount: number;
  interestedCount: number;
  rsvpStatus: RsvpStatus;
  status?: "draft" | "approved" | "rejected";
  rejectionReason?: string;
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: "Academic",
  cultural: "Cultural",
  social: "Social",
  sports: "Sports",
  org: "Organization",
};

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  academic: "#3b82f6",
  cultural: "#8b5cf6",
  social: "#ec4899",
  sports: "#f59e0b",
  org: "#10b981",
};

/** Get all events bound to a given landmark. */
export function getEventsAtLandmark(landmarkId: string, events: CampusEvent[]): CampusEvent[] {
  return events.filter((e) => e.locationId === landmarkId);
}
