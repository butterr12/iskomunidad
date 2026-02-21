import Link from "next/link";
import { cn } from "@/lib/utils";
import { splitTextWithMentions } from "@/lib/mentions";

interface MentionTextProps {
  text: string;
  className?: string;
  mentionClassName?: string;
  onMentionClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export function MentionText({
  text,
  className,
  mentionClassName,
  onMentionClick,
}: MentionTextProps) {
  const parts = splitTextWithMentions(text);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, idx) =>
        part.kind === "mention" ? (
          <Link
            key={`mention-${idx}-${part.username}`}
            href={`/profile/${part.username.toLowerCase()}`}
            className={cn("font-medium text-primary hover:underline", mentionClassName)}
            onClick={onMentionClick}
          >
            @{part.username}
          </Link>
        ) : (
          <span key={`text-${idx}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}
