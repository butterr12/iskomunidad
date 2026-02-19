export type FlairCategory = "school" | "role" | "interest" | "achievement";
export type FlairTier = "basic" | "campus" | "provisioned";

export interface FlairDefinition {
  id: string;
  label: string;
  shortLabel: string;
  category: FlairCategory;
  color: string;
  tier: FlairTier;
  icon?: string;
}

export interface DisplayFlair extends FlairDefinition {
  visible: boolean;
}

export const USER_FLAIR_CATALOG: FlairDefinition[] = [
  // Schools — campus (auto-derived from user.university)
  { id: "up-diliman", label: "UP Diliman", shortLabel: "UPD", category: "school", color: "#8b1a1a", tier: "campus" },
  { id: "up-manila", label: "UP Manila", shortLabel: "UPM", category: "school", color: "#2e7d32", tier: "campus" },
  // Schools — provisioned (must be explicitly granted)
  { id: "ateneo", label: "Ateneo de Manila", shortLabel: "ADMU", category: "school", color: "#1565c0", tier: "provisioned" },
  { id: "dlsu", label: "De La Salle University", shortLabel: "DLSU", category: "school", color: "#1b5e20", tier: "provisioned" },
  // Roles — provisioned
  { id: "org-leader", label: "Org Leader", shortLabel: "Leader", category: "role", color: "#f59e0b", tier: "provisioned" },
  { id: "moderator", label: "Moderator", shortLabel: "Mod", category: "role", color: "#8b5cf6", tier: "provisioned" },
  { id: "alumni", label: "Alumni", shortLabel: "Alumni", category: "role", color: "#6b7280", tier: "provisioned" },
  // Interests — provisioned
  { id: "dev", label: "Developer", shortLabel: "Dev", category: "interest", color: "#06b6d4", tier: "provisioned" },
  { id: "creative", label: "Creative", shortLabel: "Creative", category: "interest", color: "#ec4899", tier: "provisioned" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getFlairById(id: string): FlairDefinition | undefined {
  return USER_FLAIR_CATALOG.find((f) => f.id === id);
}

export function getBasicFlairIds(): string[] {
  return USER_FLAIR_CATALOG.filter((f) => f.tier === "basic").map((f) => f.id);
}

/** Map university value → campus flair id (e.g. "up-diliman" → "up-diliman") */
export function getCampusFlairId(university: string): string | undefined {
  const flair = USER_FLAIR_CATALOG.find(
    (f) => f.tier === "campus" && f.id === university,
  );
  return flair?.id;
}

export function getProvisionedFlairIds(): string[] {
  return USER_FLAIR_CATALOG.filter((f) => f.tier === "provisioned").map((f) => f.id);
}
