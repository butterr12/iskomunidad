"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MapPin, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryPicker } from "@/components/shared/category-picker";
import { StarRating } from "@/components/shared/star-rating";
import {
  OperatingHoursInput,
  getDefaultOperatingHours,
} from "@/components/shared/operating-hours-input";
import { TagInput } from "@/components/shared/tag-input";
import {
  PhotoUpload,
  type UploadedPhoto,
} from "@/components/admin/photo-upload";
import { createLandmark, createReview } from "@/actions/landmarks";
import type { OperatingHours } from "@/lib/landmarks";

const LocationPickerMap = dynamic(
  () =>
    import("@/components/admin/location-picker-map").then(
      (m) => m.LocationPickerMap,
    ),
  { ssr: false },
);

// ─── Draft persistence ───────────────────────────────────────────────────────

const DRAFT_KEY = "isk:add-location-draft";

interface LocationDraft {
  lat: number | null;
  lng: number | null;
  name: string;
  categoryId: string | null;
  description: string;
  tags: string[];
  address: string;
  phone: string;
  website: string;
  showHours: boolean;
  operatingHours: OperatingHours;
  photos: UploadedPhoto[];
  reviewRating: number;
  reviewBody: string;
  savedAt: number;
}

function loadDraft(): LocationDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocationDraft;
    // Expire after 24 hours
    if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(draft: Omit<LocationDraft, "savedAt">) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch {
    // quota exceeded — ignore
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function hasMeaningfulContent(draft: Omit<LocationDraft, "savedAt">): boolean {
  return !!(
    draft.name.trim() ||
    draft.description.trim() ||
    draft.categoryId ||
    draft.lat !== null
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────

export function AddLocationForm() {
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Section 1: Location
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Section 2: About
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Section 3: Details
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(
    getDefaultOperatingHours(),
  );

  // Section 4: Photos & Review
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setLat(draft.lat);
      setLng(draft.lng);
      setName(draft.name);
      setCategoryId(draft.categoryId);
      setDescription(draft.description);
      setTags(draft.tags);
      setAddress(draft.address);
      setPhone(draft.phone);
      setWebsite(draft.website);
      setShowHours(draft.showHours);
      setOperatingHours(draft.operatingHours);
      setPhotos(draft.photos);
      setReviewRating(draft.reviewRating);
      setReviewBody(draft.reviewBody);
      setHasDraft(true);
    }
    setInitialized(true);
  }, []);

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialized) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const draft = {
        lat, lng, name, categoryId, description, tags,
        address, phone, website, showHours, operatingHours,
        photos, reviewRating, reviewBody,
      };
      if (hasMeaningfulContent(draft)) {
        saveDraft(draft);
        setHasDraft(true);
      }
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    initialized, lat, lng, name, categoryId, description, tags,
    address, phone, website, showHours, operatingHours,
    photos, reviewRating, reviewBody,
  ]);

  const handleDiscardDraft = () => {
    clearDraft();
    setLat(null);
    setLng(null);
    setName("");
    setCategoryId(null);
    setDescription("");
    setTags([]);
    setAddress("");
    setPhone("");
    setWebsite("");
    setShowHours(false);
    setOperatingHours(getDefaultOperatingHours());
    setPhotos([]);
    setReviewRating(0);
    setReviewBody("");
    setHasDraft(false);
    toast.success("Draft discarded");
  };

  const handleMapLocationChange = useCallback(
    (newLat: number, newLng: number) => {
      setLat(newLat);
      setLng(newLng);
    },
    [],
  );

  const handleUseCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => toast.error("Could not get your location"),
      { timeout: 5000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lat || !lng) {
      toast.error("Please select a location on the map");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createLandmark({
        name: name.trim(),
        description: description.trim(),
        categoryId,
        lat,
        lng,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        operatingHours: showHours ? operatingHours : undefined,
        tags,
        photos: photos.map((p) => ({
          url: p.key,
          caption: p.caption || undefined,
        })),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Optional first review
      if (reviewRating > 0) {
        await createReview({
          landmarkId: result.data.id,
          rating: reviewRating,
          body: reviewBody.trim() || undefined,
        });
      }

      clearDraft();
      toast.success(
        "Location submitted! It'll appear on the map once approved.",
      );
      router.push("/map");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-6">
      {/* Draft indicator */}
      {hasDraft && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            Draft restored
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDiscardDraft}
          >
            <Trash2 className="h-3 w-3" />
            Discard
          </Button>
        </div>
      )}

      {/* Section 1: Location */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Location</h3>
          <LocationPickerMap
            lat={lat}
            lng={lng}
            onLocationChange={handleMapLocationChange}
            height="350px"
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleUseCurrentLocation}
            >
              <MapPin className="h-3.5 w-3.5" />
              Use current location
            </Button>
            {lat !== null && lng !== null && (
              <p className="text-xs text-muted-foreground">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: About this place */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <h3 className="text-sm font-semibold">About this place</h3>

          <div className="space-y-2">
            <Label htmlFor="place-name">Name *</Label>
            <Input
              id="place-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sunken Garden"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <CategoryPicker value={categoryId} onChange={setCategoryId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="place-description">Description *</Label>
            <Textarea
              id="place-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what this place is about..."
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} maxTags={10} />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Details (optional) */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <h3 className="text-sm font-semibold">Details (optional)</h3>

          <div className="space-y-2">
            <Label htmlFor="place-address">Address</Label>
            <Input
              id="place-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
              maxLength={500}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="place-phone">Phone</Label>
              <Input
                id="place-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-website">Website</Label>
              <Input
                id="place-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Operating Hours</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowHours(!showHours)}
              >
                {showHours ? "Remove" : "Add hours"}
              </Button>
            </div>
            {showHours && (
              <OperatingHoursInput
                value={operatingHours}
                onChange={setOperatingHours}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Photos & First Review */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <h3 className="text-sm font-semibold">Photos & First Review (optional)</h3>

          <div className="space-y-2">
            <Label>Photos</Label>
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={5} />
          </div>

          <div className="space-y-2">
            <Label>Your Rating</Label>
            <StarRating
              value={reviewRating}
              onChange={setReviewRating}
              size="lg"
            />
            {reviewRating > 0 && (
              <Textarea
                placeholder="Share your experience (optional)"
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={submitting} size="lg">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit for Review
      </Button>
    </form>
  );
}
