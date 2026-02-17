/* eslint-disable */
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export function CreateGigForm({ open, onOpenChange, onSubmit }: CreateGigFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GigCategory | "">("");
  const [compensation, setCompensation] = useState("");
  const [urgency, setUrgency] = useState<GigUrgency>("flexible");
  const [contactMethod, setContactMethod] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    title.trim() &&
    description.trim() &&
    category &&
    compensation.trim() &&
    contactMethod.trim() &&
    !submitting;

  function reset() {
    setTitle("");
    setDescription("");
    setCategory("");
    setCompensation("");
    setUrgency("flexible");
    setContactMethod("");
    setDeadline("");
    setTagsInput("");
    setLocationNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const result = await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        compensation: compensation.trim(),
        urgency,
        contactMethod: contactMethod.trim(),
        deadline: deadline || undefined,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Post a Gig</SheetTitle>
          <SheetDescription>Find help from the campus community</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gig-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="gig-title"
              placeholder="e.g. Need a tutor for Calculus"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gig-desc" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="gig-desc"
              placeholder="Describe what you need help with..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
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

          {/* Contact method */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gig-contact" className="text-sm font-medium">
              Contact Method
            </label>
            <Input
              id="gig-contact"
              placeholder="e.g. DM on Facebook, text 09XX..."
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value)}
            />
          </div>

          {/* Deadline (optional) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gig-deadline" className="text-sm font-medium">
              Deadline <span className="text-muted-foreground">(optional)</span>
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
            <label htmlFor="gig-tags" className="text-sm font-medium">
              Tags <span className="text-muted-foreground">(optional, comma-separated)</span>
            </label>
            <Input
              id="gig-tags"
              placeholder="e.g. math, tutoring, online"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          {/* Location note (optional) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gig-location" className="text-sm font-medium">
              Location Note <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="gig-location"
              placeholder="e.g. Near AS Building"
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
            />
          </div>
        </form>

        {/* Sticky submit button outside scrollable area */}
        <div className="border-t px-4 py-3">
          <Button
            type="button"
            disabled={!canSubmit}
            className="w-full"
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest("[data-slot='sheet-content']")?.querySelector("form");
              form?.requestSubmit();
            }}
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
