import type { Landmark } from "./landmarks";

export type EventCategory = "academic" | "cultural" | "social" | "sports" | "org";
export type RsvpStatus = "going" | "interested" | null;

export interface CampusEvent {
  id: string;
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

/** Resolve an event's locationId to its Landmark, or null if online / not found. */
export function resolveLocation(event: CampusEvent, landmarks: Landmark[]): Landmark | null {
  if (!event.locationId) return null;
  return landmarks.find((l) => l.id === event.locationId) ?? null;
}

/** "View on Map" uses the landmark directly — just find it by locationId. */
export function eventToLandmark(event: CampusEvent, landmarks: Landmark[]): Landmark | null {
  return resolveLocation(event, landmarks);
}

/** Get all events bound to a given landmark. */
export function getEventsAtLandmark(landmarkId: string, events: CampusEvent[]): CampusEvent[] {
  return events.filter((e) => e.locationId === landmarkId);
}
