/* eslint-disable */
"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { getGigTags } from "@/actions/gigs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  GIG_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  type GigCategory,
  type GigUrgency,
} from "@/lib/gigs";

interface CreateGigFormData {
  title: string;
  description: string;
  category: string;
  compensation: string;
  urgency: GigUrgency;
  contactMethod: string;
  deadline?: string;
  tags: string[];
  locationNote?: string;
}

interface CreateGigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateGigFormData) => Promise<{ success: boolean }>;
}

const URGENCIES: GigUrgency[] = ["flexible", "soon", "urgent"];

type ContactPlatform = "in-app" | "facebook" | "whatsapp" | "telegram" | "email" | "other";

const CONTACT_OPTIONS: { id: ContactPlatform; label: string; emoji: string; placeholder: string | null }[] = [
  { id: "in-app", label: "Message here", emoji: "💬", placeholder: null },
  { id: "facebook", label: "Facebook", emoji: "📘", placeholder: "@username or profile link" },
  { id: "whatsapp", label: "WhatsApp", emoji: "📱", placeholder: "+63 9XX XXX XXXX" },
  { id: "telegram", label: "Telegram", emoji: "✈️", placeholder: "@username" },
  { id: "email", label: "Email", emoji: "✉️", placeholder: "your@email.com" },
  { id: "other", label: "Other", emoji: "🔗", placeholder: "How to reach you..." },
];

export function CreateGigForm({ open, onOpenChange, onSubmit }: CreateGigFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GigCategory | "">("");
  const [compensation, setCompensation] = useState("");
  const [urgency, setUrgency] = useState<GigUrgency>("flexible");
  const [contactPlatform, setContactPlatform] = useState<ContactPlatform>("in-app");
  const [contactHandle, setContactHandle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [locationNote, setLocationNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    getGigTags().then((res) => {
      if (res.success) setExistingTags(res.data);
    });
  }, [open]);

  function cleanTag(input: string): string {
    return input.replace(/^#+/, "").toLowerCase().trim().replace(/\s+/g, "-");
  }

  function addTag(input: string) {
    const clean = cleanTag(input);
    if (!clean || tags.includes(clean) || tags.length >= 10) return;
    setTags((prev) => [...prev, clean]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleTagInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val.endsWith(",") || val.endsWith(" ")) {
      addTag(val.slice(0, -1));
      return;
    }
    setTagInput(val);
    setShowSuggestions(true);
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagInput.trim()) addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const filteredSuggestions = existingTags
    .filter((t) => {
      const q = cleanTag(tagInput);
      return (!q || t.includes(q)) && !tags.includes(t);
    })
    .slice(0, 8);

  const canCreateNew =
    tagInput.trim() &&
    !existingTags.includes(cleanTag(tagInput)) &&
    !tags.includes(cleanTag(tagInput));

  const step1Valid = !!(title.trim() && category && compensation.trim());
  const step2Valid = !!description.trim();
  const contactValid = contactPlatform === "in-app" || contactHandle.trim().length > 0;
  const canSubmit = step1Valid && step2Valid && contactValid && !submitting;

  function buildContactMethod(): string {
    if (contactPlatform === "in-app") return "in-app";
    if (contactPlatform === "other") return contactHandle.trim();
    const label = CONTACT_OPTIONS.find((o) => o.id === contactPlatform)?.label ?? contactPlatform;
    return `${label}: ${contactHandle.trim()}`;
  }

  function reset() {
    setStep(1);
    setTitle("");
    setDescription("");
    setCategory("");
    setCompensation("");
    setUrgency("flexible");
    setContactPlatform("in-app");
    setContactHandle("");
    setDeadline("");
    setTags([]);
    setTagInput("");
    setLocationNote("");
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        compensation: compensation.trim(),
        urgency,
        contactMethod: buildContactMethod(),
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        tags,
        locationNote: locationNote.trim() || undefined,
      });
      if (result.success) {
        reset();
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Post a Gig</DialogTitle>
          <DialogDescription>Find help from the campus community</DialogDescription>
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex items-center gap-2 px-6 pb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                s <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            {step} / 3
          </span>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6">
          {step === 1 && (
            <div className="flex flex-col gap-4 pb-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                The Basics
              </p>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="gig-title" className="text-sm font-medium">
                    Title
                  </label>
                  <span className="text-xs text-muted-foreground">{title.length}/200</span>
                </div>
                <Input
                  id="gig-title"
                  placeholder="e.g. Need a tutor for Calculus"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  autoFocus
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  {GIG_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                    >
                      <Badge
                        variant={category === c ? "default" : "outline"}
                        style={
                          category === c
                            ? { backgroundColor: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] }
                            : { borderColor: CATEGORY_COLORS[c], color: CATEGORY_COLORS[c] }
                        }
                        className="cursor-pointer"
                      >
                        {CATEGORY_LABELS[c]}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Compensation */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="gig-comp" className="text-sm font-medium">
                  Compensation
                </label>
                <Input
                  id="gig-comp"
                  placeholder="e.g. ₱500/hr, Volunteer, Negotiable"
                  value={compensation}
                  onChange={(e) => setCompensation(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 pb-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Details
              </p>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="gig-desc" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="gig-desc"
                  placeholder="Describe what you need help with, when, and any requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  autoFocus
                />
              </div>

              {/* Urgency */}
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Urgency</p>
                <div className="flex gap-1">
                  {URGENCIES.map((u) => (
                    <Button
                      key={u}
                      type="button"
                      variant={urgency === u ? "default" : "outline"}
                      size="sm"
                      style={
                        urgency === u
                          ? { backgroundColor: URGENCY_COLORS[u], borderColor: URGENCY_COLORS[u] }
                          : undefined
                      }
                      onClick={() => setUrgency(u)}
                    >
                      {URGENCY_LABELS[u]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Deadline (optional) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="gig-deadline" className="text-sm font-medium">
                  Deadline <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  id="gig-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              {/* Tags (optional) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Tags <span className="text-muted-foreground font-normal">(optional)</span>
                  </p>
                  {tags.length > 0 && (
                    <span className="text-xs text-muted-foreground">{tags.length}/10</span>
                  )}
                </div>

                {/* Chip input */}
                <div className="relative">
                  <div
                    className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                    onClick={() => tagInputRef.current?.focus()}
                  >
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                          className="rounded-full hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {tags.length < 10 && (
                      <input
                        ref={tagInputRef}
                        value={tagInput}
                        onChange={handleTagInputChange}
                        onKeyDown={handleTagKeyDown}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        placeholder={tags.length === 0 ? "#math, #tutoring…" : ""}
                        className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    )}
                  </div>

                  {/* Suggestions dropdown */}
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
                            onClick={() => addTag(tagInput)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-primary hover:bg-accent"
                          >
                            <span className="font-medium">+</span>
                            <span>Create <span className="font-medium">#{cleanTag(tagInput)}</span></span>
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
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4 pb-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Contact &amp; Review
              </p>

              {/* Contact method */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">How can applicants reach you?</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {CONTACT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setContactPlatform(opt.id);
                        setContactHandle("");
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors text-left",
                        contactPlatform === opt.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
                {contactPlatform === "in-app" ? (
                  <p className="text-xs text-muted-foreground">
                    Applicants can message you directly through the app — no need to share personal contact info.
                  </p>
                ) : (
                  <Input
                    placeholder={CONTACT_OPTIONS.find((o) => o.id === contactPlatform)?.placeholder ?? ""}
                    value={contactHandle}
                    onChange={(e) => setContactHandle(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              {/* Location note (optional) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="gig-location" className="text-sm font-medium">
                  Location Note <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  id="gig-location"
                  placeholder="e.g. Near AS Building"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                />
              </div>

              {/* Live preview */}
              {(title || compensation || category) && (
                <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Preview
                  </p>
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-center">
                      <p className="text-xs font-bold text-white leading-tight">
                        {compensation || "—"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight line-clamp-1">
                        {title || "Untitled gig"}
                      </p>
                      {category && (
                        <span
                          className="inline-block self-start rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: CATEGORY_COLORS[category as GigCategory] + "22",
                            color: CATEGORY_COLORS[category as GigCategory],
                          }}
                        >
                          {CATEGORY_LABELS[category as GigCategory]}
                        </span>
                      )}
                    </div>
                  </div>
                  {description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="border-t px-6 py-4">
          <div className="flex gap-2">
            {step === 1 ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              >
                ← Back
              </Button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                className="flex-1"
                disabled={step === 1 ? !step1Valid : !step2Valid}
                onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              >
                Next →
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Post Gig"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
