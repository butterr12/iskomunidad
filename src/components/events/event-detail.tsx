"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, MapPin, Globe, Users, User, Share2, Star, Check } from "lucide-react";
import type { CampusEvent, RsvpStatus } from "@/lib/events";

interface EventDetailProps {
  event: CampusEvent;
  onBack: () => void;
  onRsvpChange: (eventId: string, status: RsvpStatus) => void;
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${startTime} - ${endTime}`;
}

const categoryLabels: Record<string, string> = {
  academic: "Academic",
  cultural: "Cultural",
  social: "Social",
  sports: "Sports",
  org: "Organization",
};

export function EventDetail({ event, onBack, onRsvpChange }: EventDetailProps) {
  const router = useRouter();

  const toggleRsvp = (status: RsvpStatus) => {
    onRsvpChange(event.id, event.rsvpStatus === status ? null : status);
  };

  return (
    <div className="flex flex-col">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 border-b px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </button>

      {/* Cover color block */}
      <div className="h-32" style={{ backgroundColor: event.coverColor }} />

      <div className="flex flex-col gap-4 p-5">
        {/* Title & category */}
        <div>
          <h2 className="text-xl font-semibold leading-tight">{event.title}</h2>
          <Badge variant="secondary" className="mt-2">
            {categoryLabels[event.category] ?? event.category}
          </Badge>
        </div>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Info rows */}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formatDateRange(event.startDate, event.endDate)}</span>
          </div>
          <div className="flex items-start gap-2">
            {event.locationId ? (
              <>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>On Campus</span>
              </>
            ) : (
              <>
                <Globe className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Online Event</span>
              </>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {event.attendeeCount.toLocaleString()} going · {event.interestedCount.toLocaleString()} interested
            </span>
          </div>
          <div className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Organized by {event.organizer}</span>
          </div>
        </div>

        {/* Description */}
        <div className="border-t pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex gap-2">
            <Button
              variant={event.rsvpStatus === "going" ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => toggleRsvp("going")}
            >
              <Check className="h-3.5 w-3.5" />
              Going
            </Button>
            <Button
              variant={event.rsvpStatus === "interested" ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => toggleRsvp("interested")}
            >
              <Star className="h-3.5 w-3.5" />
              Interested
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          </div>
          {event.locationId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/map?landmark=${event.locationId}`)}
            >
              <MapPin className="h-3.5 w-3.5" />
              View on Map
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
