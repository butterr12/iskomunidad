import { GigCard } from "./gig-card";
import type { GigListing } from "@/lib/gigs";

interface GigListProps {
  gigs: GigListing[];
  onSelectGig: (gig: GigListing) => void;
}

export function GigList({ gigs, onSelectGig }: GigListProps) {
  if (gigs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <p className="text-sm text-muted-foreground">No gigs found</p>
        <p className="text-xs text-muted-foreground">Try changing your filters</p>
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
