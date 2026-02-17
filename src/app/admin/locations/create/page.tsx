/* eslint-disable */
"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminCreateLandmark } from "@/actions/admin";
import { PhotoUpload, type UploadedPhoto } from "@/components/admin/photo-upload";
import type { LandmarkCategory } from "@/lib/landmarks";

const LocationPickerMap = dynamic(
  () => import("@/components/admin/location-picker-map").then((m) => m.LocationPickerMap),
  { ssr: false },
);

const LANDMARK_CATEGORIES: { value: LandmarkCategory; label: string }[] = [
  { value: "attraction", label: "Attraction" },
  { value: "community", label: "Community" },
  { value: "event", label: "Event Venue" },
];

export default function CreateLocationPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<LandmarkCategory>("attraction");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [address, setAddress] = useState("");
  const [tags, setTags] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedLat = lat === "" ? null : parseFloat(lat);
  const parsedLng = lng === "" ? null : parseFloat(lng);
  const validLat = parsedLat !== null && !isNaN(parsedLat) ? parsedLat : null;
  const validLng = parsedLng !== null && !isNaN(parsedLng) ? parsedLng : null;

  const handleMapLocationChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat.toFixed(6));
    setLng(newLng.toFixed(6));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lat || !lng) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await adminCreateLandmark({
        name: name.trim(),
        description: description.trim(),
        category,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: address.trim() || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        photos: photos.map((p) => ({ url: p.key, caption: p.caption || undefined, source: "upload" as const })),
      });

      if (res.success) {
        setCreated({ id: res.data.id, name: name.trim() });
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Location Created!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              &quot;{created.name}&quot; has been created.
            </p>
            <Badge variant="default" className="mt-2">
              Created
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/locations">View All Locations</Link>
            </Button>
            <Button onClick={() => {
              setCreated(null);
              setName("");
              setDescription("");
              setLat("");
              setLng("");
              setAddress("");
              setTags("");
              setPhotos([]);
            }}>
              Create Another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Location</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as LandmarkCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANDMARK_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pin Location *</Label>
            <p className="text-sm text-muted-foreground">Click on the map to place a pin, or drag the pin to adjust.</p>
            <LocationPickerMap lat={validLat} lng={validLng} onLocationChange={handleMapLocationChange} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude *</Label>
              <Input id="lat" type="number" step="any" placeholder="e.g. 14.6537" value={lat} onChange={(e) => setLat(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">Longitude *</Label>
              <Input id="lng" type="number" step="any" placeholder="e.g. 121.0691" value={lng} onChange={(e) => setLng(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" placeholder="e.g. park, nature, scenic" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Photos</Label>
            <PhotoUpload photos={photos} onChange={setPhotos} />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Location"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
