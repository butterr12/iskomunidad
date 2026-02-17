"use client";

import { useState } from "react";
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
import { createLandmark, getSettings } from "@/lib/admin-store";
import type { Landmark, LandmarkCategory } from "@/lib/landmarks";

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
  const [created, setCreated] = useState<Landmark | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lat || !lng) return;

    const landmark = createLandmark({
      name: name.trim(),
      description: description.trim(),
      category,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address: address.trim() || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });

    setCreated(landmark);
  };

  if (created) {
    const settings = getSettings();
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Location Created!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              &quot;{created.name}&quot; has been created.
            </p>
            <Badge
              variant={created.status === "approved" ? "default" : "secondary"}
              className="mt-2"
            >
              {created.status === "approved" ? "Approved (auto)" : "Draft (pending review)"}
            </Badge>
            {!settings.autoApprove && (
              <p className="text-xs text-muted-foreground mt-2">
                Auto-approve is OFF. This location requires manual approval.
              </p>
            )}
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

          <Button type="submit">Create Location</Button>
        </form>
      </CardContent>
    </Card>
  );
}
