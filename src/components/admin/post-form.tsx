/* eslint-disable */
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
import { PhotoUpload, type UploadedPhoto } from "@/components/admin/photo-upload";
import { adminCreatePost } from "@/actions/admin";
import { getApprovedLandmarks } from "@/actions/landmarks";
import { POST_FLAIRS, FLAIR_COLORS, type PostFlair } from "@/lib/posts";
import type { Landmark } from "@/lib/landmarks";

export function PostForm() {
  const [title, setTitle] = useState("");
  const [flair, setFlair] = useState<PostFlair>("Discussion");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [locationId, setLocationId] = useState("");
  const [created, setCreated] = useState<{ id: string; title: string; status: string } | null>(null);
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
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const imageKeys = photos.map((p) => p.key);
      const res = await adminCreatePost({
        title: title.trim(),
        flair,
        body: body.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        imageKeys: imageKeys.length > 0 ? imageKeys : undefined,
        locationId: locationId && locationId !== "none" ? locationId : undefined,
      });

      if (res.success) {
        setCreated({ id: res.data.id, title: title.trim(), status: "approved" });
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
            <h3 className="text-lg font-semibold">Post Created!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              &quot;{created.title}&quot; has been created.
            </p>
            <Badge variant="default" className="mt-2">
              Created
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/posts">View All Posts</Link>
            </Button>
            <Button onClick={() => {
              setCreated(null);
              setTitle("");
              setBody("");
              setLinkUrl("");
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
        <CardTitle>New Post</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Flair</Label>
            <Select value={flair} onValueChange={(v) => setFlair(v as PostFlair)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POST_FLAIRS.map((f) => (
                  <SelectItem key={f} value={f}>
                    <span style={{ color: FLAIR_COLORS[f] }}>{f}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkUrl">Link URL (optional)</Label>
            <Input id="linkUrl" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <Label>Images (optional, up to 4)</Label>
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={4} />
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
