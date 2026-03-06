/** Admin-seedable interest tags — default pool */
export const INTEREST_TAGS = [
  "Coffee", "Matcha", "Film", "Music", "Anime", "Gaming", "Hiking",
  "Fitness", "Poetry", "Thrifting", "Cooking", "Photography", "Art",
  "Reading", "Podcasts", "Startups", "Activism", "Dance", "Theater",
  "K-pop", "Jazz", "Basketball", "Volleyball", "Running", "Yoga",
  "Cats", "Dogs", "Board Games", "Astrology", "Memes",
] as const;

export const PROMPT_CATEGORIES = ["vulnerability", "taste", "campus", "flirty"] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  vulnerability: "Vulnerability",
  taste: "Taste",
  campus: "Campus",
  flirty: "Flirty",
};
