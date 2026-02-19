export type BorderTier = "basic" | "gradient" | "exclusive";
export type BorderType = "solid" | "gradient" | "animated";

export interface BorderDefinition {
  id: string;
  label: string;
  tier: BorderTier;
  type: BorderType;
  color: string; // solid: hex | gradient/animated: CSS gradient string
}

export const PROFILE_BORDER_CATALOG: BorderDefinition[] = [
  // ─── Basic (free for all) ───────────────────────────────────────────────────
  { id: "none", label: "None", tier: "basic", type: "solid", color: "transparent" },
  { id: "maroon", label: "Maroon", tier: "basic", type: "solid", color: "#8b1a1a" },
  { id: "gold", label: "Gold", tier: "basic", type: "solid", color: "#d4a017" },
  { id: "emerald", label: "Emerald", tier: "basic", type: "solid", color: "#2e7d32" },
  { id: "sapphire", label: "Sapphire", tier: "basic", type: "solid", color: "#1565c0" },
  { id: "violet", label: "Violet", tier: "basic", type: "solid", color: "#7c3aed" },
  { id: "coral", label: "Coral", tier: "basic", type: "solid", color: "#ef6c57" },
  { id: "slate", label: "Slate", tier: "basic", type: "solid", color: "#64748b" },
  { id: "rose", label: "Rose", tier: "basic", type: "solid", color: "#e11d77" },

  // ─── Gradient (individually unlockable) ─────────────────────────────────────
  { id: "sunset", label: "Sunset", tier: "gradient", type: "gradient", color: "linear-gradient(135deg, #f97316, #ec4899)" },
  { id: "ocean", label: "Ocean", tier: "gradient", type: "gradient", color: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
  { id: "aurora", label: "Aurora", tier: "gradient", type: "gradient", color: "linear-gradient(135deg, #10b981, #8b5cf6)" },
  { id: "neon", label: "Neon", tier: "gradient", type: "gradient", color: "linear-gradient(135deg, #f43f5e, #a855f7)" },

  // ─── Exclusive (special unlocks) ────────────────────────────────────────────
  { id: "early-joiner", label: "Early Joiner", tier: "exclusive", type: "animated", color: "conic-gradient(from 0deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #10b981, #f59e0b)" },
  { id: "feedback-loop", label: "Feedback Loop", tier: "exclusive", type: "animated", color: "conic-gradient(from 0deg, #d97706, #06b6d4, #3b82f6, #d97706)" },
];

export function getBorderById(id: string): BorderDefinition | null {
  if (!id || id === "none") return null;
  return PROFILE_BORDER_CATALOG.find((b) => b.id === id) ?? null;
}

/** Get all borders grouped by tier */
export function getBordersByTier(): Record<BorderTier, BorderDefinition[]> {
  return {
    basic: PROFILE_BORDER_CATALOG.filter((b) => b.tier === "basic"),
    gradient: PROFILE_BORDER_CATALOG.filter((b) => b.tier === "gradient"),
    exclusive: PROFILE_BORDER_CATALOG.filter((b) => b.tier === "exclusive"),
  };
}
