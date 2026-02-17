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
import { createPost, getSettings } from "@/lib/admin-store";
import { POST_FLAIRS, FLAIR_COLORS, type PostType, type PostFlair, type CommunityPost } from "@/lib/posts";
import { landmarks } from "@/lib/landmarks";

export function PostForm() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PostType>("text");
  const [flair, setFlair] = useState<PostFlair>("Discussion");
  const [author, setAuthor] = useState("");
  const [authorHandle, setAuthorHandle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageEmoji, setImageEmoji] = useState("");
  const [imageColor, setImageColor] = useState("#3b82f6");
  const [locationId, setLocationId] = useState("");
  const [created, setCreated] = useState<CommunityPost | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !authorHandle.trim()) return;

    const post = createPost({
      title: title.trim(),
      type,
      flair,
      author: author.trim(),
      authorHandle: authorHandle.trim().startsWith("@") ? authorHandle.trim() : `@${authorHandle.trim()}`,
      body: type === "text" ? body.trim() || undefined : undefined,
      linkUrl: type === "link" ? linkUrl.trim() || undefined : undefined,
      imageEmoji: type === "image" ? imageEmoji.trim() || undefined : undefined,
      imageColor: type === "image" ? imageColor : undefined,
      locationId: locationId && locationId !== "none" ? locationId : undefined,
    });

    setCreated(post);
  };

  if (created) {
    const settings = getSettings();
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Post Created!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              &quot;{created.title}&quot; has been created.
            </p>
            <Badge
              variant={created.status === "approved" ? "default" : "secondary"}
              className="mt-2"
            >
              {created.status === "approved" ? "Approved (auto)" : "Draft (pending review)"}
            </Badge>
            {!settings.autoApprove && (
              <p className="text-xs text-muted-foreground mt-2">
                Auto-approve is OFF. This post requires manual approval.
              </p>
            )}
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
              setImageEmoji("");
              setAuthor("");
              setAuthorHandle("");
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PostType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="author">Author Name *</Label>
              <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="handle">Author Handle *</Label>
              <Input id="handle" placeholder="@handle" value={authorHandle} onChange={(e) => setAuthorHandle(e.target.value)} required />
            </div>
          </div>

          {type === "text" && (
            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          )}

          {type === "link" && (
            <div className="space-y-2">
              <Label htmlFor="linkUrl">Link URL</Label>
              <Input id="linkUrl" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            </div>
          )}

          {type === "image" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emoji">Image Emoji</Label>
                <Input id="emoji" value={imageEmoji} onChange={(e) => setImageEmoji(e.target.value)} placeholder="e.g. 🎉" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Image Color</Label>
                <Input id="color" type="color" value={imageColor} onChange={(e) => setImageColor(e.target.value)} />
              </div>
            </div>
          )}

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

          <Button type="submit">Create Post</Button>
        </form>
      </CardContent>
    </Card>
  );
}
