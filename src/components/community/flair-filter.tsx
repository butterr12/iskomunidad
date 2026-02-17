import { Badge } from "@/components/ui/badge";
import { POST_FLAIRS, FLAIR_COLORS, type PostFlair } from "@/lib/posts";

interface FlairFilterProps {
  activeFlair: PostFlair | null;
  onFlairChange: (flair: PostFlair | null) => void;
}

export function FlairFilter({ activeFlair, onFlairChange }: FlairFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-none">
      <button
        onClick={() => onFlairChange(null)}
        className="shrink-0"
      >
        <Badge variant={activeFlair === null ? "default" : "outline"}>
          All
        </Badge>
      </button>
      {POST_FLAIRS.map((flair) => (
        <button
          key={flair}
          onClick={() => onFlairChange(activeFlair === flair ? null : flair)}
          className="shrink-0"
        >
          <Badge
            variant={activeFlair === flair ? "default" : "outline"}
            style={
              activeFlair === flair
                ? { backgroundColor: FLAIR_COLORS[flair], borderColor: FLAIR_COLORS[flair] }
                : { borderColor: FLAIR_COLORS[flair], color: FLAIR_COLORS[flair] }
            }
          >
            {flair}
          </Badge>
        </button>
      ))}
    </div>
  );
}
