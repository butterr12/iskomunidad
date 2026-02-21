"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  searchMentionableUsers,
  type MentionCandidate,
} from "@/actions/follows";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MENTION_BOUNDARY, MENTION_WORD_CHARS } from "@/lib/mentions";
import { cn } from "@/lib/utils";

const TRIGGER_REGEX = new RegExp(
  `(^|${MENTION_BOUNDARY})@([${MENTION_WORD_CHARS}]*)$`,
);
const WORD_CHAR_REGEX = new RegExp(`[${MENTION_WORD_CHARS}]`);

type MentionFieldElement = HTMLInputElement | HTMLTextAreaElement;
type MentionFieldKeyEvent = React.KeyboardEvent<MentionFieldElement>;
type MentionFieldFocusEvent = React.FocusEvent<MentionFieldElement>;
type MentionFieldChangeEvent = React.ChangeEvent<MentionFieldElement>;
type MentionFieldMouseEvent = React.MouseEvent<MentionFieldElement>;

type ActiveMention = {
  start: number;
  end: number;
  query: string;
};

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  containerClassName?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  multiline?: boolean;
  onKeyDown?: (event: MentionFieldKeyEvent) => void;
  onBlur?: (event: MentionFieldFocusEvent) => void;
  onFocus?: (event: MentionFieldFocusEvent) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getActiveMention(value: string, caret: number): ActiveMention | null {
  const textBeforeCaret = value.slice(0, caret);
  const match = TRIGGER_REGEX.exec(textBeforeCaret);
  if (!match) return null;

  const start = textBeforeCaret.length - match[0].length + match[1].length;

  // Consume remaining word characters after caret (e.g. caret in "@ali|ce")
  let end = caret;
  while (end < value.length && WORD_CHAR_REGEX.test(value[end])) {
    end++;
  }

  return { start, end, query: match[2] };
}

export function MentionInput({
  value,
  onChange,
  id,
  containerClassName,
  className,
  placeholder,
  disabled,
  maxLength,
  rows,
  multiline = false,
  onKeyDown,
  onBlur,
  onFocus,
}: MentionInputProps) {
  const generatedId = useId();
  const instanceId = id ?? generatedId;
  const listboxId = `mention-listbox-${instanceId}`;

  const fieldRef = useRef<MentionFieldElement | null>(null);
  const [caretIndex, setCaretIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);

  const activeMention = useMemo(
    () => getActiveMention(value, Math.max(0, Math.min(caretIndex, value.length))),
    [caretIndex, value],
  );

  const activeTokenKey = activeMention
    ? `${activeMention.start}:${activeMention.end}:${activeMention.query}`
    : null;
  const mentionQuery = activeMention?.query ?? "";

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(mentionQuery),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [mentionQuery]);

  const shouldSearch =
    isFocused &&
    !!activeMention &&
    activeMention.query.length > 0 &&
    dismissedToken !== activeTokenKey;

  const { data: candidates = [], isFetching } = useQuery<MentionCandidate[]>({
    queryKey: ["mentionable-users", debouncedQuery],
    queryFn: async () => {
      const res = await searchMentionableUsers(debouncedQuery);
      return res.success ? res.data : [];
    },
    enabled: shouldSearch && debouncedQuery.length > 0,
  });

  const dropdownOpen = shouldSearch && debouncedQuery.length > 0;
  const activeIndex =
    candidates.length > 0
      ? Math.min(highlightedIndex, candidates.length - 1)
      : 0;

  const activeDescendantId =
    dropdownOpen && candidates.length > 0 && !isFetching
      ? `mention-option-${instanceId}-${activeIndex}`
      : undefined;

  const syncCaret = (target: MentionFieldElement) => {
    fieldRef.current = target;
    setCaretIndex(target.selectionStart ?? target.value.length);
  };

  const applyMention = (candidate: MentionCandidate) => {
    if (!activeMention) return;

    const mentionText = `@${candidate.username} `;
    const nextValue =
      value.slice(0, activeMention.start) +
      mentionText +
      value.slice(activeMention.end);
    const nextCaret = activeMention.start + mentionText.length;

    onChange(nextValue);
    setCaretIndex(nextCaret);
    setDismissedToken(null);
    setHighlightedIndex(0);

    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleKeyDown = (event: MentionFieldKeyEvent) => {
    syncCaret(event.currentTarget);

    if (dropdownOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (candidates.length > 0) {
          setHighlightedIndex((idx) => (idx + 1) % candidates.length);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (candidates.length > 0) {
          setHighlightedIndex((idx) =>
            idx === 0 ? candidates.length - 1 : idx - 1,
          );
        }
        return;
      }

      if (event.key === "Enter" && candidates[activeIndex]) {
        event.preventDefault();
        applyMention(candidates[activeIndex]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (activeTokenKey) setDismissedToken(activeTokenKey);
        return;
      }
    }

    onKeyDown?.(event);
  };

  const sharedProps = {
    id: instanceId,
    value,
    placeholder,
    disabled,
    maxLength,
    className,
    autoComplete: "off" as const,
    role: "combobox" as const,
    "aria-expanded": dropdownOpen,
    "aria-controls": listboxId,
    "aria-activedescendant": activeDescendantId,
    "aria-autocomplete": "list" as const,
    onChange: (event: MentionFieldChangeEvent) => {
      onChange(event.target.value);
      syncCaret(event.target);
      setHighlightedIndex(0);
    },
    onKeyDown: handleKeyDown,
    onClick: (event: MentionFieldMouseEvent) => syncCaret(event.currentTarget),
    onKeyUp: (event: React.KeyboardEvent<MentionFieldElement>) =>
      syncCaret(event.currentTarget),
    onSelect: (event: React.SyntheticEvent<MentionFieldElement>) =>
      syncCaret(event.currentTarget),
    onFocus: (event: MentionFieldFocusEvent) => {
      setIsFocused(true);
      syncCaret(event.currentTarget);
      onFocus?.(event);
    },
    onBlur: (event: MentionFieldFocusEvent) => {
      setIsFocused(false);
      onBlur?.(event);
    },
  };

  return (
    <div className={cn("relative", containerClassName)}>
      {multiline ? (
        <Textarea {...sharedProps} rows={rows} />
      ) : (
        <Input {...sharedProps} />
      )}

      {dropdownOpen && (
        <div className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-50 rounded-md border bg-popover shadow-md">
          {isFetching ? (
            <div className="flex items-center justify-center p-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="sr-only">Searching users...</span>
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No users found
            </p>
          ) : (
            <div id={listboxId} role="listbox" aria-label="Mention suggestions" className="max-h-60 overflow-y-auto p-1">
              {candidates.map((candidate, idx) => (
                <button
                  key={candidate.id}
                  id={`mention-option-${instanceId}-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors",
                    idx === activeIndex && "bg-accent",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyMention(candidate);
                  }}
                >
                  <Avatar size="sm">
                    <AvatarImage
                      src={candidate.image ?? undefined}
                      alt={candidate.name}
                    />
                    <AvatarFallback>
                      {getInitials(candidate.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {candidate.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      @{candidate.username}
                    </p>
                  </div>
                  {candidate.isMutual && (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      Mutual
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
