import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  formatRelativeTime,
  gigToLandmark,
  type GigListing,
} from "@/lib/gigs";

interface SwipeCardProps {
  gig: GigListing;
}

export function SwipeCard({ gig }: SwipeCardProps) {
  const location = gigToLandmark(gig);

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card shadow-lg overflow-hidden">
      {/* Category color header */}
      <div
        className="h-2 shrink-0"
        style={{ backgroundColor: CATEGORY_COLORS[gig.category] }}
      />

      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="secondary"
            style={{ backgroundColor: CATEGORY_COLORS[gig.category] + "20", color: CATEGORY_COLORS[gig.category] }}
          >
            {CATEGORY_LABELS[gig.category]}
          </Badge>
          <Badge
            variant="secondary"
            style={{ backgroundColor: URGENCY_COLORS[gig.urgency] + "20", color: URGENCY_COLORS[gig.urgency] }}
          >
            {URGENCY_LABELS[gig.urgency]}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold leading-tight">{gig.title}</h3>

        {/* Description */}
        <p className="line-clamp-3 text-sm text-muted-foreground">{gig.description}</p>

        {/* Key details table */}
        <div className="mt-auto flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pay</span>
            <span className="font-medium">{gig.isPaid ? gig.compensation : "Volunteer"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">When</span>
            <span className="font-medium">{URGENCY_LABELS[gig.urgency]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Where</span>
            <span className="truncate ml-4 font-medium">
              {location?.name ?? gig.locationNote ?? "Flexible"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Posted by</span>
            <span className="truncate ml-4 font-medium">{gig.posterName}</span>
          </div>
        </div>

        {/* Timestamp */}
        <p className="text-center text-xs text-muted-foreground">
          Posted {formatRelativeTime(gig.createdAt)} ago
        </p>
      </div>
    </div>
  );
}
