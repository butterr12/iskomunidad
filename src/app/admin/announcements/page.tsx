"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BellRing,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PhotoUpload,
  type UploadedPhoto,
} from "@/components/admin/photo-upload";
import {
  adminGetAnnouncements,
  adminCreateAnnouncement,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
  adminToggleAnnouncement,
  type Announcement,
} from "@/actions/announcements";

const QUERY_KEY = ["admin-announcements"] as const;

interface FormValues {
  title: string;
  body: string;
  imageKey: string;
  ctaLabel: string;
  ctaUrl: string;
  expiresAt: string;
  isActive: boolean;
  priority: number;
}

const DEFAULT_FORM: FormValues = {
  title: "",
  body: "",
  imageKey: "",
  ctaLabel: "",
  ctaUrl: "",
  expiresAt: "",
  isActive: true,
  priority: 0,
};

function AnnouncementFormDialog({
  open,
  onOpenChange,
  announcement,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement | null;
  onSave: () => void;
}) {
  const [form, setForm] = useState<FormValues>(() =>
    announcement
      ? {
          title: announcement.title,
          body: announcement.body ?? "",
          imageKey: announcement.imageKey ?? "",
          ctaLabel: announcement.ctaLabel ?? "",
          ctaUrl: announcement.ctaUrl ?? "",
          expiresAt: announcement.expiresAt
            ? new Date(announcement.expiresAt).toISOString().slice(0, 16)
            : "",
          isActive: announcement.isActive,
          priority: announcement.priority,
        }
      : DEFAULT_FORM,
  );
  const [saving, setSaving] = useState(false);

  const photos: UploadedPhoto[] = form.imageKey
    ? [{ key: form.imageKey, previewUrl: `/api/photos/${form.imageKey}`, caption: "" }]
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      body: form.body || null,
      imageKey: form.imageKey || null,
      ctaLabel: form.ctaLabel || null,
      ctaUrl: form.ctaUrl || null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      isActive: form.isActive,
      priority: form.priority,
    };
    const res = announcement
      ? await adminUpdateAnnouncement(announcement.id, payload)
      : await adminCreateAnnouncement(payload);
    setSaving(false);
    if (res.success) {
      toast.success(announcement ? "Announcement updated." : "Announcement created.");
      onSave();
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {announcement ? "Edit Announcement" : "New Announcement"}
          </DialogTitle>
          <DialogDescription>
            {announcement
              ? "Update the announcement details."
              : "Create a popup announcement shown to users on their next visit."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-title">Title *</Label>
            <Input
              id="ann-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. New feature: Campus Match!"
              maxLength={200}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-body">Body</Label>
            <Textarea
              id="ann-body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Optional longer description..."
              maxLength={2000}
              rows={4}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Hero Image</Label>
            <PhotoUpload
              photos={photos}
              onChange={(p) =>
                setForm((f) => ({ ...f, imageKey: p[0]?.key ?? "" }))
              }
              maxPhotos={1}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ann-cta-label">CTA Label</Label>
              <Input
                id="ann-cta-label"
                value={form.ctaLabel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ctaLabel: e.target.value }))
                }
                placeholder="e.g. Try it now"
                maxLength={50}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ann-cta-url">CTA URL</Label>
              <Input
                id="ann-cta-url"
                value={form.ctaUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ctaUrl: e.target.value }))
                }
                placeholder="https://..."
                type="url"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-priority">Priority (0–100)</Label>
            <Input
              id="ann-priority"
              type="number"
              min={0}
              max={100}
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Higher priority announcements are shown first.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-expires">Expires at</Label>
            <Input
              id="ann-expires"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, expiresAt: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to never expire.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="ann-active"
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
            <Label htmlFor="ann-active">Active</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : announcement ? (
                "Save changes"
              ) : (
                "Create announcement"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAnnouncements();
      return res.success ? res.data : [];
    },
  });

  const handleToggle = async (id: string, isActive: boolean) => {
    queryClient.setQueryData<Announcement[]>(QUERY_KEY, (old) =>
      old?.map((a) => (a.id === id ? { ...a, isActive } : a)) ?? [],
    );
    const res = await adminToggleAnnouncement(id, isActive);
    if (!res.success) {
      toast.error(res.error);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    const res = await adminDeleteAnnouncement(deletingId);
    setDeleting(false);
    setDeletingId(null);
    if (res.success) {
      toast.success("Announcement deleted.");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } else {
      toast.error(res.error);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Popup announcements shown to users on their next visit.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <BellRing className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No announcements yet
          </p>
          <p className="text-xs text-muted-foreground">
            Create one to show a popup announcement to all users.
          </p>
          <Button
            onClick={openCreate}
            variant="outline"
            size="sm"
            className="mt-1 gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            New Announcement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm"
            >
              {a.imageKey && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border">
                  <Image
                    src={`/api/photos/${a.imageKey}`}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{a.title}</span>
                  <Badge variant="outline" className="text-[11px]">
                    Priority {a.priority}
                  </Badge>
                  {!a.isActive && (
                    <Badge
                      variant="outline"
                      className="text-[11px] text-muted-foreground"
                    >
                      Inactive
                    </Badge>
                  )}
                  {a.expiresAt && new Date(a.expiresAt) < new Date() && (
                    <Badge
                      variant="outline"
                      className="text-[11px] text-muted-foreground"
                    >
                      Expired
                    </Badge>
                  )}
                </div>
                {a.body && (
                  <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2">
                    {a.body}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {a.ctaLabel && a.ctaUrl && (
                    <a
                      href={a.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {a.ctaLabel}
                    </a>
                  )}
                  {a.expiresAt && (
                    <span>
                      Expires {new Date(a.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  <span>
                    Created {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Switch
                  checked={a.isActive}
                  onCheckedChange={(v) => handleToggle(a.id, v)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(a)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeletingId(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnnouncementFormDialog
        key={editing?.id ?? "new"}
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditing(null);
        }}
        announcement={editing}
        onSave={() =>
          queryClient.invalidateQueries({ queryKey: QUERY_KEY })
        }
      />

      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this announcement?</DialogTitle>
            <DialogDescription>
              This cannot be undone. All seen records will also be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
