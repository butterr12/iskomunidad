import { Badge } from "@/components/ui/badge";
import { MapPin, Users } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  formatRelativeTime,
  type GigListing,
} from "@/lib/gigs";

interface GigCardProps {
  gig: GigListing;
  onSelect: (gig: GigListing) => void;
}

export function GigCard({ gig, onSelect }: GigCardProps) {
  return (
    <button
      onClick={() => onSelect(gig)}
      className="flex w-full gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/50"
    >
      {/* Compensation box */}
      <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-muted px-3 py-2 text-center">
        {gig.isPaid ? (
          <>
            <span className="text-sm font-bold leading-tight">
              {gig.compensation.replace("PHP ", "₱").split("/")[0]}
            </span>
            {gig.compensation.includes("/") && (
              <span className="text-[10px] text-muted-foreground">
                /{gig.compensation.split("/")[1]}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">Vol</span>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Title */}
        <h3 className="truncate text-sm font-semibold leading-tight">{gig.title}</h3>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: CATEGORY_COLORS[gig.category], color: CATEGORY_COLORS[gig.category] }}
          >
            {CATEGORY_LABELS[gig.category]}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: URGENCY_COLORS[gig.urgency], color: URGENCY_COLORS[gig.urgency] }}
          >
            {URGENCY_LABELS[gig.urgency]}
          </Badge>
        </div>

        {/* Description preview */}
        <p className="line-clamp-2 text-xs text-muted-foreground">{gig.description}</p>

        {/* Footer */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{gig.posterName}</span>
          {(gig.locationId || gig.locationNote) && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {gig.locationNote ?? "On Campus"}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {gig.applicantCount}
          </span>
          <span className="ml-auto">{formatRelativeTime(gig.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}
