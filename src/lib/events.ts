import { landmarks, type Landmark } from "./landmarks";

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
  locationId?: string; // FK → Landmark.id — omit for online events
  tags: string[];
  coverColor: string;
  attendeeCount: number;
  interestedCount: number;
  rsvpStatus: RsvpStatus;
  status?: "draft" | "approved" | "rejected";
  rejectionReason?: string;
}

/** Resolve an event's locationId to its Landmark, or null if online / not found. */
export function resolveLocation(event: CampusEvent): Landmark | null {
  if (!event.locationId) return null;
  return landmarks.find((l) => l.id === event.locationId) ?? null;
}

/** "View on Map" uses the landmark directly — just find it by locationId. */
export function eventToLandmark(event: CampusEvent): Landmark | null {
  return resolveLocation(event);
}

/** Get all events bound to a given landmark. */
export function getEventsAtLandmark(landmarkId: string, events: CampusEvent[]): CampusEvent[] {
  return events.filter((e) => e.locationId === landmarkId);
}

export const mockEvents: CampusEvent[] = [
  {
    id: "career-fair",
    title: "UP Career Fair 2026",
    description:
      "Meet top employers from tech, finance, and public service. Bring your resume and dress smart-casual. Over 50 companies will be present offering internships and full-time positions for graduating students.",
    category: "academic",
    organizer: "UP Office of Student Affairs",
    startDate: "2026-02-25T09:00:00+08:00",
    endDate: "2026-02-25T17:00:00+08:00",
    locationId: "quezon-hall",
    tags: ["career", "networking", "jobs"],
    coverColor: "#2563eb",
    attendeeCount: 342,
    interestedCount: 1205,
    rsvpStatus: null,
  },
  {
    id: "film-festival",
    title: "Cine Adarna Film Festival",
    description:
      "A week-long showcase of award-winning Filipino independent films, student shorts, and documentary features. Q&A sessions with directors after each screening.",
    category: "cultural",
    organizer: "UP Film Institute",
    startDate: "2026-03-05T14:00:00+08:00",
    endDate: "2026-03-05T21:00:00+08:00",
    locationId: "up-theater",
    tags: ["film", "arts", "culture"],
    coverColor: "#9333ea",
    attendeeCount: 189,
    interestedCount: 874,
    rsvpStatus: "interested",
  },
  {
    id: "lantern-parade",
    title: "UP Lantern Parade",
    description:
      "The beloved annual tradition where colleges compete with giant, intricately designed lantern floats parading through the Academic Oval. A celebration of creativity and school spirit.",
    category: "cultural",
    organizer: "UP Diliman University Student Council",
    startDate: "2026-12-18T17:00:00+08:00",
    endDate: "2026-12-18T21:00:00+08:00",
    locationId: "sunken-garden",
    tags: ["tradition", "parade", "holiday"],
    coverColor: "#f59e0b",
    attendeeCount: 2104,
    interestedCount: 5420,
    rsvpStatus: "going",
  },
  {
    id: "webdev-workshop",
    title: "Web Dev Workshop: React & Next.js",
    description:
      "A hands-on online workshop covering modern web development with React 19 and Next.js App Router. Open to all skill levels. Participants will build a full-stack app by the end of the session.",
    category: "academic",
    organizer: "UP Computer Science Guild",
    startDate: "2026-03-01T10:00:00+08:00",
    endDate: "2026-03-01T16:00:00+08:00",
    // no locationId — online event
    tags: ["tech", "workshop", "webdev"],
    coverColor: "#06b6d4",
    attendeeCount: 78,
    interestedCount: 312,
    rsvpStatus: null,
  },
  {
    id: "intramurals",
    title: "UP Diliman Intramurals 2026",
    description:
      "The annual inter-college athletic competition featuring basketball, volleyball, swimming, track and field, and more. Come cheer for your college!",
    category: "sports",
    organizer: "UP Diliman Office of Physical Education",
    startDate: "2026-02-28T07:00:00+08:00",
    endDate: "2026-02-28T18:00:00+08:00",
    locationId: "sunken-garden",
    tags: ["sports", "competition", "athletics"],
    coverColor: "#e11d48",
    attendeeCount: 560,
    interestedCount: 1890,
    rsvpStatus: null,
  },
  {
    id: "eco-summit",
    title: "Campus Eco Summit",
    description:
      "A student-led environmental summit discussing sustainability initiatives, waste reduction, and green campus policies. Features panel discussions with environmental scientists and local government leaders.",
    category: "org",
    organizer: "UP Mountaineers & Eco Warriors",
    startDate: "2026-03-15T09:00:00+08:00",
    endDate: "2026-03-15T17:00:00+08:00",
    locationId: "as-steps",
    tags: ["environment", "sustainability", "advocacy"],
    coverColor: "#16a34a",
    attendeeCount: 145,
    interestedCount: 620,
    rsvpStatus: null,
  },
  // Draft events (pending moderation)
  {
    id: "poetry-night",
    title: "Open Mic Poetry Night",
    description:
      "An evening of spoken word and poetry performances by UP students and guest artists. Open mic slots available — sign up at the door.",
    category: "cultural",
    organizer: "UP Writers Club",
    startDate: "2026-03-20T18:00:00+08:00",
    endDate: "2026-03-20T21:00:00+08:00",
    locationId: "as-steps",
    tags: ["poetry", "arts", "open mic"],
    coverColor: "#7c3aed",
    attendeeCount: 0,
    interestedCount: 0,
    rsvpStatus: null,
    status: "draft",
  },
  {
    id: "hackathon-2026",
    title: "UP Hackathon 2026",
    description:
      "A 24-hour hackathon where student teams build solutions for real-world problems. Prizes from tech sponsors. Free food and energy drinks provided.",
    category: "academic",
    organizer: "UP Association for Computing Machinery",
    startDate: "2026-04-05T08:00:00+08:00",
    endDate: "2026-04-06T08:00:00+08:00",
    locationId: "main-library",
    tags: ["tech", "hackathon", "competition"],
    coverColor: "#0ea5e9",
    attendeeCount: 0,
    interestedCount: 0,
    rsvpStatus: null,
    status: "draft",
  },
  // Rejected event
  {
    id: "sketchy-party",
    title: "Mega Campus Party!!!",
    description:
      "BIGGEST PARTY EVER. Details TBA. DM for tickets.",
    category: "social",
    organizer: "Unknown Org",
    startDate: "2026-04-01T20:00:00+08:00",
    endDate: "2026-04-02T04:00:00+08:00",
    tags: ["party"],
    coverColor: "#ef4444",
    attendeeCount: 0,
    interestedCount: 0,
    rsvpStatus: null,
    status: "rejected",
    rejectionReason: "Event lacks proper organizational affiliation and violates campus event guidelines.",
  },
];
