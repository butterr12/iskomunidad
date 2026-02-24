import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagChipsProps {
  tags: string[];
  maxVisible?: number;
  className?: string;
  chipClassName?: string;
  onTagClick?: React.MouseEventHandler;
}

export function TagChips({
  tags,
  maxVisible,
  className,
  chipClassName,
  onTagClick,
}: TagChipsProps) {
  if (!tags || tags.length === 0) return null;

  const visible = maxVisible ? tags.slice(0, maxVisible) : tags;
  const hidden = maxVisible ? tags.length - maxVisible : 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((tag) => (
        <Link
          key={tag}
          href={`/t/${encodeURIComponent(tag)}`}
          onClick={onTagClick}
          className={cn(
            "text-[10px] font-medium text-primary/70 hover:text-primary hover:underline transition-colors",
            chipClassName,
          )}
        >
          #{tag}
        </Link>
      ))}
      {hidden > 0 && (
        <span className="text-[10px] text-muted-foreground/40">
          +{hidden} more
        </span>
      )}
    </div>
  );
}
