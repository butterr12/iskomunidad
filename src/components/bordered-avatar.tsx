import { type ReactNode } from "react";
import {
  getBorderById,
  type BorderDefinition,
} from "@/lib/profile-borders";

function getRingWidth(avatarSize: number): number {
  if (avatarSize >= 80) return 4;
  if (avatarSize >= 48) return 3;
  if (avatarSize >= 32) return 2.5;
  return 2;
}

interface BorderedAvatarProps {
  /** Pass a resolved border directly (from DB) */
  border?: BorderDefinition | null;
  /** Or pass a borderId for preview (settings page) */
  borderId?: string;
  avatarSize: number;
  children: ReactNode;
}

export function BorderedAvatar({
  border: borderProp,
  borderId,
  avatarSize,
  children,
}: BorderedAvatarProps) {
  // Resolve: explicit prop > borderId lookup > null
  const border =
    borderProp !== undefined
      ? borderProp
      : borderId
        ? getBorderById(borderId)
        : null;

  const ringWidth = getRingWidth(avatarSize);

  // No border selected — still reserve space with transparent padding
  if (!border) {
    return (
      <div
        className="rounded-full shrink-0"
        style={{ padding: ringWidth }}
      >
        {children}
      </div>
    );
  }

  // Feedback Loop: gradient border + pulsing rays around the circle
  if (border.id === "feedback-loop") {
    const outerSize = avatarSize + ringWidth * 2;
    const center = outerSize / 2;
    const rayStart = center + 1;
    const rayEnd = center + Math.max(4, outerSize * 0.15);
    const rayCount = 12;
    return (
      <div
        className="relative rounded-full shrink-0"
        style={{ width: outerSize, height: outerSize }}
      >
        {/* Gradient border layer */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: border.color }}
        />
        {/* Inner mask */}
        <div
          className="absolute rounded-full bg-background"
          style={{
            top: ringWidth,
            left: ringWidth,
            right: ringWidth,
            bottom: ringWidth,
          }}
        />
        {/* Avatar content */}
        <div
          className="relative rounded-full"
          style={{ padding: ringWidth }}
        >
          {children}
        </div>
        {/* Rays radiating from the circle border */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={outerSize}
          height={outerSize}
          viewBox={`0 0 ${outerSize} ${outerSize}`}
          overflow="visible"
        >
          {Array.from({ length: rayCount }).map((_, i) => {
            const angle = (i * 360 / rayCount) * (Math.PI / 180);
            const x1 = center + Math.cos(angle) * rayStart;
            const y1 = center - Math.sin(angle) * rayStart;
            const x2 = center + Math.cos(angle) * rayEnd;
            const y2 = center - Math.sin(angle) * rayEnd;
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#eab308"
                strokeWidth={1.5}
                strokeLinecap="round"
                style={{
                  animation: "feedback-rays 3s ease-in-out infinite",
                  animationDelay: `${(i / rayCount) * 3}s`,
                }}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  // Animated border (e.g. "Early Joiner" conic-gradient spinning)
  if (border.type === "animated") {
    const outerSize = avatarSize + ringWidth * 2;
    return (
      <div
        className="relative rounded-full shrink-0"
        style={{ width: outerSize, height: outerSize }}
      >
        {/* Spinning gradient layer */}
        <div
          className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite]"
          style={{ background: border.color }}
        />
        {/* Inner mask to create ring gap */}
        <div
          className="absolute rounded-full bg-background"
          style={{
            top: ringWidth,
            left: ringWidth,
            right: ringWidth,
            bottom: ringWidth,
          }}
        />
        {/* Avatar content */}
        <div
          className="relative rounded-full"
          style={{ padding: ringWidth }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Gradient or solid border
  const isSolid = border.type === "solid";

  return (
    <div
      className="rounded-full shrink-0"
      style={{
        padding: ringWidth,
        ...(isSolid
          ? { backgroundColor: border.color }
          : { background: border.color }),
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.2)",
      }}
    >
      {children}
    </div>
  );
}
