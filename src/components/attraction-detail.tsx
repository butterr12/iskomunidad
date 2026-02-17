import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, MapPin, Navigation, Share2, Bookmark, Clock, CalendarDays, MessageCircle, Users, ExternalLink } from "lucide-react";
import { PhotoGallery } from "@/components/photo-gallery";
import { FLAIR_COLORS } from "@/lib/posts";
import type { Landmark } from "@/lib/landmarks";
import type { CampusEvent } from "@/lib/events";
import type { CommunityPost } from "@/lib/posts";

interface AttractionDetailProps {
  landmark: Landmark;
  events?: CampusEvent[];
  posts?: CommunityPost[];
  onClose: () => void;
}

function formatEventTime(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayStr = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dayStr} · ${startTime} - ${endTime}`;
}

export function AttractionDetail({ landmark, events = [], posts = [], onClose }: AttractionDetailProps) {
  return (
    <div className="flex flex-col gap-4 p-5">
      {landmark.photos && landmark.photos.length > 0 && (
        <PhotoGallery photos={landmark.photos} />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold leading-tight">
            {landmark.name}
          </h2>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {landmark.category}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {landmark.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {landmark.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <p className="text-sm leading-relaxed text-muted-foreground">
        {landmark.description}
      </p>

      {landmark.address && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{landmark.address}</span>
        </div>
      )}

      <a
        href={
          landmark.googlePlaceId
            ? `https://www.google.com/maps/place/?q=place_id:${landmark.googlePlaceId}`
            : `https://www.google.com/maps/search/?api=1&query=${landmark.lat},${landmark.lng}`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View on Google Maps
      </a>

      <div className="flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(landmark.lat + "," + landmark.lng)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="h-3.5 w-3.5" />
            Directions
          </a>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>

      {/* Events at this location */}
      {events.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Upcoming Events</h3>
          </div>
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border bg-card p-3"
            >
              <div
                className="mb-2 h-[3px] -mx-3 -mt-3 rounded-t-lg"
                style={{ backgroundColor: event.coverColor }}
              />
              <h4 className="font-medium leading-tight text-sm">{event.title}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">{event.organizer}</p>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{formatEventTime(event.startDate, event.endDate)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.attendeeCount.toLocaleString()} going · {event.interestedCount.toLocaleString()} interested
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Community Posts at this location */}
      {posts.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Community Posts</h3>
          </div>
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-lg border bg-card p-3"
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  style={{ borderColor: FLAIR_COLORS[post.flair], color: FLAIR_COLORS[post.flair] }}
                >
                  {post.flair}
                </Badge>
                <span>{post.authorHandle}</span>
              </div>
              <h4 className="font-medium leading-tight text-sm">{post.title}</h4>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{post.score} points</span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {post.commentCount}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
