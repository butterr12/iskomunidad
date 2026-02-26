import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TypingIndicator({
  showAvatar,
  user,
}: {
  showAvatar: boolean;
  user: { name: string; image: string | null };
}) {
  return (
    <div className="px-4 py-0.5 animate-in fade-in duration-200">
      <div className="flex items-end gap-2 flex-row">
        {showAvatar ? (
          <Avatar size="sm" className="shrink-0 mb-px">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="text-xs">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-6 shrink-0" />
        )}
        <div className="rounded-2xl bg-muted px-3 py-2.5 flex items-center gap-1">
          <span
            className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-typing-dot-bounce"
          />
          <span
            className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-typing-dot-bounce"
            style={{ animationDelay: "0.2s" }}
          />
          <span
            className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-typing-dot-bounce"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
      </div>
    </div>
  );
}
