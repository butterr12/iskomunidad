"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Clock, MapPin, Globe, Users, User, Share2, Star, Check, Pencil, Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { deleteEvent } from "@/actions/events";
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
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = session?.user?.id === event.userId;

  const toggleRsvp = (status: RsvpStatus) => {
    onRsvpChange(event.id, event.rsvpStatus === status ? null : status);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteEvent(event.id);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ["approved-events"] });
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      onBack();
    }
    setDeleting(false);
    setShowDeleteDialog(false);
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

      <div className="flex flex-col gap-4 p-5">
        {/* Title & category */}
        <div>
          <h2 className="text-xl font-semibold leading-tight">{event.title}</h2>
          <Badge variant="secondary" className="mt-2">
            {categoryLabels[event.category] ?? event.category}
          </Badge>
        </div>

        {/* Owner controls */}
        {isOwner && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/events/${event.id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}

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

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{event.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
