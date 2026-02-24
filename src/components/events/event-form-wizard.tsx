/* eslint-disable */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Check, Camera, X, Plus, Link2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createEvent, updateEvent } from "@/actions/events";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { getApprovedLandmarks } from "@/actions/landmarks";
import { compressImageForUpload } from "@/lib/image-compression";
import type { CampusEvent, EventCategory } from "@/lib/events";
import type { Landmark } from "@/lib/landmarks";

const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "academic", label: "Academic" },
  { value: "cultural", label: "Cultural" },
  { value: "social", label: "Social" },
  { value: "sports", label: "Sports" },
  { value: "org", label: "Organization" },
];

const COVER_COLORS = [
  "#2563eb", "#9333ea", "#f59e0b", "#e11d48", "#16a34a", "#06b6d4", "#7c3aed", "#0ea5e9",
];

const SUGGESTED_TAGS = [
  "workshop", "seminar", "lecture", "networking", "career",
  "sports", "cultural", "social", "food", "tech",
  "arts", "music", "volunteer", "free", "fundraiser",
  "competition", "study", "research", "showcase", "expo",
];

function combineDateAndTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined.toISOString();
}

function extractDate(isoString: string): Date {
  return new Date(isoString);
}

function extractTime(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface EventFormWizardProps {
  mode: "create" | "edit";
  initialData?: CampusEvent;
  autoApprove?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EventFormWizard({ mode, initialData, autoApprove = true, open, onOpenChange, onSuccess }: EventFormWizardProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  // Step 1 fields
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [category, setCategory] = useState<EventCategory>(initialData?.category ?? "academic");

  // Step 2 fields
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialData?.startDate ? extractDate(initialData.startDate) : undefined,
  );
  const [startTime, setStartTime] = useState(
    initialData?.startDate ? extractTime(initialData.startDate) : "09:00",
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    initialData?.endDate ? extractDate(initialData.endDate) : undefined,
  );
  const [endTime, setEndTime] = useState(
    initialData?.endDate ? extractTime(initialData.endDate) : "17:00",
  );

  // Step 3 fields
  const [externalLinks, setExternalLinks] = useState<{ label: string; url: string }[]>(initialData?.externalLinks ?? []);
  const [locationId, setLocationId] = useState(initialData?.locationId ?? "none");
  const [organizer, setOrganizer] = useState(initialData?.organizer ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags ?? []);
  const [customTagInput, setCustomTagInput] = useState("");
  const [coverColor, setCoverColor] = useState(initialData?.coverColor ?? COVER_COLORS[0]);
  const [coverImageKey, setCoverImageKey] = useState<string | null>(initialData?.coverImageKey ?? null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    getApprovedLandmarks().then((res) => {
      if (res.success) setLandmarks(res.data as Landmark[]);
    });
  }, []);

  const handleBannerUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const compressed = await compressImageForUpload(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { key } = await res.json();
      setCoverImageKey(key);
      setCoverImagePreview(URL.createObjectURL(file));
    } catch {
      toast.error("Failed to upload banner image");
    } finally {
      setImageUploading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomTag = (input: string) => {
    const cleaned = input.replace(/#/g, "").trim().toLowerCase().slice(0, 30);
    if (cleaned && !selectedTags.includes(cleaned)) {
      setSelectedTags((prev) => [...prev, cleaned]);
    }
    setCustomTagInput("");
  };

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      return title.trim().length > 0 && description.trim().length > 0;
    }
    if (s === 2) {
      return !!startDate && !!endDate && !!startTime && !!endTime;
    }
    if (s === 3) {
      return organizer.trim().length > 0;
    }
    return false;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 3));
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else if (onOpenChange) onOpenChange(false);
    else router.back();
  };

  const handleSubmit = async () => {
    if (!validateStep(3) || !startDate || !endDate) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      organizer: organizer.trim(),
      startDate: combineDateAndTime(startDate, startTime),
      endDate: combineDateAndTime(endDate, endTime),
      locationId: locationId !== "none" ? locationId : undefined,
      tags: selectedTags,
      coverColor,
      coverImageKey: coverImageKey,
      externalLinks: externalLinks.filter(l => l.label.trim() && l.url.trim()),
    };

    try {
      const res =
        mode === "create"
          ? await createEvent(payload)
          : await updateEvent(initialData!.id, payload);

      if (res.success) {
        const status = (res.data as { status?: string }).status;
        if (mode === "create") {
          posthog?.capture("event_created", { status, category: payload.category });
          toast.success(
            status === "draft"
              ? "Event submitted for review."
              : "Event created!",
          );
        } else {
          toast.success(
            status === "draft"
              ? "Event update submitted for review."
              : "Event updated!",
          );
        }
        if (onOpenChange) {
          onOpenChange(false);
          onSuccess?.();
        } else {
          router.push("/events");
        }
      } else {
        toast.error(res.error);
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const bannerDisplaySrc = coverImagePreview ?? (coverImageKey ? `/api/photos/${coverImageKey}` : null);

  const stepLabels = ["Details", "Date & Time", "More Info"];

  const formContent = (
    <>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 py-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                s < step
                  ? "border-primary bg-primary text-primary-foreground"
                  : s === step
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground/50",
              )}
            >
              {s < step ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "h-0.5 w-6 rounded-full transition-colors",
                  s < step ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        ))}
      </div>
      <div className="text-center text-xs text-muted-foreground pb-1">
        Step {step}: {stepLabels[step - 1]}
      </div>

      {/* Re-approval warning */}
      {mode === "edit" && !autoApprove && initialData?.status === "approved" && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Editing will require re-approval by an admin.
        </div>
      )}

      {/* Form content */}
      <div className="flex-1 overflow-y-auto pr-1">
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Event title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="What's this event about?"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {/* Banner upload */}
            <div className="space-y-2">
              <Label>Event Banner (recommended: 16:9)</Label>
              <div
                className={cn(
                  "relative aspect-video w-full overflow-hidden rounded-lg border-2 border-dashed",
                  "flex cursor-pointer items-center justify-center bg-muted/30 transition-colors",
                  imageUploading ? "opacity-60" : "hover:border-primary/50",
                )}
                onClick={() => {
                  if (!imageUploading) document.getElementById("banner-upload")?.click();
                }}
              >
                {bannerDisplaySrc ? (
                  <>
                    <img
                      src={bannerDisplaySrc}
                      alt="Banner preview"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverImageKey(null);
                        setCoverImagePreview(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {imageUploading ? (
                      <span className="text-xs">Uploading…</span>
                    ) : (
                      <>
                        <Camera className="h-8 w-8 opacity-40" />
                        <span className="text-xs">Click to upload banner image</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerUpload(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Online (no location)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Online / Virtual</SelectItem>
                  {landmarks.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizer">Organizer *</Label>
              <Input
                id="organizer"
                placeholder="Who's organizing this?"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
              />
            </div>

            {/* External Links */}
            <div className="space-y-2">
              <Label>External Links <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {externalLinks.map((link, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Label (e.g. Register)"
                    value={link.label}
                    onChange={(e) => setExternalLinks(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                    className="w-1/3"
                  />
                  <Input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => setExternalLinks(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setExternalLinks(prev => prev.filter((_, j) => j !== i))}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {externalLinks.length < 5 && (
                <button
                  type="button"
                  onClick={() => setExternalLinks(prev => [...prev, { label: "", url: "" }])}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Link
                </button>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              {/* Selected tag badges */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                      className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                    >
                      #{tag}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              {/* Suggested chips */}
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      selectedTags.includes(tag)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {selectedTags.includes(tag) ? `#${tag}` : tag}
                  </button>
                ))}
              </div>
              {/* Custom tag input */}
              <Input
                placeholder="Add custom tag (press Enter or comma)"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addCustomTag(customTagInput);
                  }
                }}
              />
            </div>

            {/* Accent color */}
            <div className="space-y-2">
              <div>
                <Label>Accent Color</Label>
                <p className="text-xs text-muted-foreground">Used for category badges and overlays</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {COVER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCoverColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      coverColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <label
                  aria-label="Pick a custom accent color"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40"
                >
                  <input
                    type="color"
                    value={coverColor}
                    onChange={(e) => setCoverColor(e.target.value)}
                    className="sr-only"
                  />
                  <span className="sr-only">Custom color</span>
                  <div
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: coverColor }}
                  />
                </label>
              </div>
            </div>

            {/* Accent preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="h-20 rounded-lg"
                style={{ backgroundColor: coverColor }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Footer buttons */}
      <div className="border-t pt-3">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              className="flex-1"
              disabled={!validateStep(step)}
              onClick={handleNext}
            >
              Next
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={!validateStep(3) || submitting || imageUploading}
              onClick={handleSubmit}
            >
              {submitting
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create Event"
                  : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Event" : "Edit Event"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create and publish a new campus event" : "Update your event details"}
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
