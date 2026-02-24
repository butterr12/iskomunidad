"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanTag, MAX_TAGS } from "@/lib/tags";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  maxTags = MAX_TAGS,
  placeholder = "#add tags…",
  className,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const clean = cleanTag(raw);
    if (!clean || value.includes(clean) || value.length >= maxTags) return;
    onChange([...value, clean]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val.endsWith(",") || val.endsWith(" ")) {
      addTag(val.slice(0, -1));
      return;
    }
    setInput(val);
    setShowSuggestions(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const filteredSuggestions = suggestions
    .filter((t) => {
      const q = cleanTag(input);
      return (!q || t.includes(q)) && !value.includes(t);
    })
    .slice(0, 8);

  const canCreateNew =
    input.trim() &&
    !suggestions.includes(cleanTag(input)) &&
    !value.includes(cleanTag(input));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative">
        <div
          className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          onClick={() => inputRef.current?.focus()}
        >
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              #{tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="rounded-full hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {value.length < maxTags && (
            <input
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={value.length === 0 ? placeholder : ""}
              className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
        </div>

        {showSuggestions && (filteredSuggestions.length > 0 || canCreateNew) && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
            <div className="max-h-40 overflow-y-auto py-1">
              {filteredSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(tag)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <span className="text-muted-foreground">#</span>
                  <span>{tag}</span>
                </button>
              ))}
              {canCreateNew && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(input)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-primary hover:bg-accent"
                >
                  <span className="font-medium">+</span>
                  <span>
                    Create <span className="font-medium">#{cleanTag(input)}</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Type and press Enter or comma to add · Backspace to remove
      </p>
    </div>
  );
}
