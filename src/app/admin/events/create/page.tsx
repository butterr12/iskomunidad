"use client";

import { useState, useEffect } from "react";
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
import { adminCreateEvent } from "@/actions/admin";
import { getApprovedLandmarks } from "@/actions/landmarks";
import type { EventCategory } from "@/lib/events";
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

export default function CreateEventPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("academic");
  const [organizer, setOrganizer] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [tags, setTags] = useState("");
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  useEffect(() => {
    getApprovedLandmarks().then((res) => {
      if (res.success) setLandmarks(res.data as Landmark[]);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !organizer.trim() || !startDate || !endDate) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await adminCreateEvent({
        title: title.trim(),
        description: description.trim(),
        category,
        organizer: organizer.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        locationId: locationId && locationId !== "none" ? locationId : undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        coverColor,
      });

      if (res.success) {
        setCreated({ id: res.data.id, title: title.trim() });
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
            <h3 className="text-lg font-semibold">Event Created!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              &quot;{created.title}&quot; has been created.
            </p>
            <Badge variant="default" className="mt-2">
              Created
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/events">View All Events</Link>
            </Button>
            <Button onClick={() => {
              setCreated(null);
              setTitle("");
              setDescription("");
              setOrganizer("");
              setStartDate("");
              setEndDate("");
              setTags("");
              setLocationId("");
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
        <CardTitle>New Event</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizer">Organizer *</Label>
              <Input id="organizer" value={organizer} onChange={(e) => setOrganizer(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input id="startDate" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input id="endDate" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location (optional)</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Online (no location)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Online (no location)</SelectItem>
                {landmarks.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" placeholder="e.g. tech, workshop" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coverColor">Cover Color</Label>
              <Input id="coverColor" type="color" value={coverColor} onChange={(e) => setCoverColor(e.target.value)} />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
