"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminCreateGig } from "@/actions/admin";
import { getApprovedLandmarks } from "@/actions/landmarks";
import { GIG_CATEGORIES, CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/gigs";
import type { GigCategory, GigUrgency } from "@/lib/gigs";
import type { Landmark } from "@/lib/landmarks";

const URGENCY_OPTIONS: GigUrgency[] = ["flexible", "soon", "urgent"];

export default function CreateGigPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GigCategory>("tutoring");
  const [compensation, setCompensation] = useState("");
  const [compensationValue, setCompensationValue] = useState(0);
  const [isPaid, setIsPaid] = useState(true);
  const [urgency, setUrgency] = useState<GigUrgency>("flexible");
  const [contactMethod, setContactMethod] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tags, setTags] = useState("");
  const [posterCollege, setPosterCollege] = useState("");
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
    if (!title.trim() || !description.trim() || !compensation.trim() || !contactMethod.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await adminCreateGig({
        title: title.trim(),
        description: description.trim(),
        category,
        compensation: compensation.trim(),
        compensationValue,
        isPaid,
        urgency,
        contactMethod: contactMethod.trim(),
        locationId: locationId && locationId !== "none" ? locationId : undefined,
        locationNote: locationNote.trim() || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        posterCollege: posterCollege.trim() || undefined,
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
            <h3 className="text-lg font-semibold">Gig Created!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              &quot;{created.title}&quot; has been created.
            </p>
            <Badge variant="default" className="mt-2">
              Created
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/gigs">View All Gigs</Link>
            </Button>
            <Button onClick={() => {
              setCreated(null);
              setTitle("");
              setDescription("");
              setCompensation("");
              setCompensationValue(0);
              setIsPaid(true);
              setContactMethod("");
              setLocationId("");
              setLocationNote("");
              setDeadline("");
              setTags("");
              setPosterCollege("");
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
        <CardTitle>New Gig</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as GigCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GIG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as GigUrgency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{URGENCY_LABELS[u]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="compensation">Compensation *</Label>
              <Input id="compensation" placeholder='e.g. "₱500/hr"' value={compensation} onChange={(e) => setCompensation(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compensationValue">Compensation Value (for sorting)</Label>
              <Input id="compensationValue" type="number" value={compensationValue} onChange={(e) => setCompensationValue(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="isPaid" checked={isPaid} onCheckedChange={(v) => setIsPaid(!!v)} />
            <Label htmlFor="isPaid">Is Paid</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactMethod">Contact Method *</Label>
            <Input id="contactMethod" placeholder="e.g. DM on Facebook, text 0917..." value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Location (optional)</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="No location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {landmarks.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationNote">Location Note (optional)</Label>
            <Input id="locationNote" placeholder="e.g. Meet at lobby" value={locationNote} onChange={(e) => setLocationNote(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input id="deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posterCollege">Poster College (optional)</Label>
              <Input id="posterCollege" placeholder="e.g. College of Engineering" value={posterCollege} onChange={(e) => setPosterCollege(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" placeholder="e.g. tutoring, math" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Gig"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
