import { Hammer } from "lucide-react";
import { GigCard } from "./gig-card";
import type { GigListing } from "@/lib/gigs";

interface GigListProps {
  gigs: GigListing[];
  onSelectGig: (gig: GigListing) => void;
}

export function GigList({ gigs, onSelectGig }: GigListProps) {
  if (gigs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <Hammer className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">No gigs posted yet</p>
        <p className="text-xs">Got something to offer? Try changing your filters or check back later!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {gigs.map((gig) => (
        <GigCard key={gig.id} gig={gig} onSelect={onSelectGig} />
      ))}
    </div>
  );
}
