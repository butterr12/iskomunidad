import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, MapPin, Navigation, Share2, Bookmark } from "lucide-react";
import type { Landmark } from "@/lib/landmarks";

interface AttractionDetailProps {
  landmark: Landmark;
  onClose: () => void;
}

export function AttractionDetail({ landmark, onClose }: AttractionDetailProps) {
  return (
    <div className="flex flex-col gap-4 p-5">
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

      <div className="flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Navigation className="h-3.5 w-3.5" />
          Directions
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
    </div>
  );
}
