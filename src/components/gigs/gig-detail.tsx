import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  DollarSign,
  MapPin,
  CalendarDays,
  User,
  GraduationCap,
  MessageCircle,
  Users,
  Share2,
  Bookmark,
  HandHelping,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  formatRelativeTime,
  type GigListing,
} from "@/lib/gigs";

interface GigDetailProps {
  gig: GigListing;
  onBack: () => void;
  onViewOnMap?: () => void;
}

export function GigDetail({ gig, onBack, onViewOnMap }: GigDetailProps) {
  return (
    <div className="flex flex-col">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 border-b px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Gigs
      </button>

      {/* Category accent bar */}
      <div
        className="h-3"
        style={{ backgroundColor: CATEGORY_COLORS[gig.category] }}
      />

      <div className="flex flex-col gap-4 p-5">
        {/* Title & badges */}
        <div>
          <h2 className="text-xl font-semibold leading-tight">{gig.title}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        </div>

        {/* Tags */}
        {gig.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {gig.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Info rows */}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <DollarSign className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{gig.compensation}</span>
          </div>
          {(gig.locationId || gig.locationNote) && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{gig.locationNote ?? "On Campus"}</span>
            </div>
          )}
          {gig.deadline && (
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Deadline:{" "}
                {new Date(gig.deadline).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {gig.posterName}{" "}
              <span className="text-muted-foreground/60">{gig.posterHandle}</span>
            </span>
          </div>
          {gig.posterCollege && (
            <div className="flex items-start gap-2">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{gig.posterCollege}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{gig.contactMethod}</span>
          </div>
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {gig.applicantCount} {gig.applicantCount === 1 ? "applicant" : "applicants"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground/60">
            Posted {formatRelativeTime(gig.createdAt)} ago
          </div>
        </div>

        {/* Description */}
        <div className="border-t pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{gig.description}</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5">
              <HandHelping className="h-3.5 w-3.5" />
              I&apos;m Interested
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          </div>
          {onViewOnMap && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onViewOnMap}>
              <MapPin className="h-3.5 w-3.5" />
              View on Map
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
