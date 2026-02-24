"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Megaphone,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminGetBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  adminToggleBanner,
  type Banner,
} from "@/actions/banners";

const VARIANT_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  urgent: "Urgent",
  success: "Success",
};

const VARIANT_BADGE_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 border-blue-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  urgent: "bg-red-100 text-red-800 border-red-200",
  success: "bg-green-100 text-green-800 border-green-200",
};

const BANNERS_QUERY_KEY = ["admin-banners"] as const;

interface BannerFormValues {
  title: string;
  body: string;
  variant: "info" | "warning" | "urgent" | "success";
  ctaLabel: string;
  ctaUrl: string;
  expiresAt: string;
  isActive: boolean;
}

const DEFAULT_FORM: BannerFormValues = {
  title: "",
  body: "",
  variant: "info",
  ctaLabel: "",
  ctaUrl: "",
  expiresAt: "",
  isActive: true,
};

function BannerFormDialog({
  open,
  onOpenChange,
  banner,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner: Banner | null;
  onSave: () => void;
}) {
  const [form, setForm] = useState<BannerFormValues>(() =>
    banner
      ? {
          title: banner.title,
          body: banner.body ?? "",
          variant: banner.variant as BannerFormValues["variant"],
          ctaLabel: banner.ctaLabel ?? "",
          ctaUrl: banner.ctaUrl ?? "",
          expiresAt: banner.expiresAt
            ? new Date(banner.expiresAt).toISOString().slice(0, 16)
            : "",
          isActive: banner.isActive,
        }
      : DEFAULT_FORM,
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      body: form.body || undefined,
      variant: form.variant,
      ctaLabel: form.ctaLabel || undefined,
      ctaUrl: form.ctaUrl || undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      isActive: form.isActive,
    };
    const res = banner
      ? await adminUpdateBanner(banner.id, payload)
      : await adminCreateBanner(payload);
    setSaving(false);
    if (res.success) {
      toast.success(banner ? "Banner updated." : "Banner created.");
      onSave();
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{banner ? "Edit Banner" : "New Banner"}</DialogTitle>
          <DialogDescription>
            {banner
              ? "Update the banner details."
              : "Create a new broadcast banner for the community feed."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-title">Title *</Label>
            <Input
              id="banner-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Classes suspended tomorrow"
              maxLength={200}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-body">Body</Label>
            <Textarea
              id="banner-body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Optional longer description..."
              maxLength={1000}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Variant</Label>
            <Select
              value={form.variant}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  variant: v as BannerFormValues["variant"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info (blue)</SelectItem>
                <SelectItem value="warning">Warning (amber)</SelectItem>
                <SelectItem value="urgent">Urgent (red)</SelectItem>
                <SelectItem value="success">Success (green)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-cta-label">CTA Label</Label>
              <Input
                id="banner-cta-label"
                value={form.ctaLabel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ctaLabel: e.target.value }))
                }
                placeholder="e.g. See schedule"
                maxLength={50}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-cta-url">CTA URL</Label>
              <Input
                id="banner-cta-url"
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
            <Label htmlFor="banner-expires">Expires at</Label>
            <Input
              id="banner-expires"
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
              id="banner-active"
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
            <Label htmlFor="banner-active">Active</Label>
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
              ) : banner ? (
                "Save changes"
              ) : (
                "Create banner"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: BANNERS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetBanners();
      return res.success ? res.data : [];
    },
  });

  const handleToggle = async (id: string, isActive: boolean) => {
    queryClient.setQueryData<Banner[]>(BANNERS_QUERY_KEY, (old) =>
      old?.map((b) => (b.id === id ? { ...b, isActive } : b)) ?? [],
    );
    const res = await adminToggleBanner(id, isActive);
    if (!res.success) {
      toast.error(res.error);
      await queryClient.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    const res = await adminDeleteBanner(deletingId);
    setDeleting(false);
    setDeletingId(null);
    if (res.success) {
      toast.success("Banner deleted.");
      await queryClient.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
    } else {
      toast.error(res.error);
    }
  };

  const openCreate = () => {
    setEditingBanner(null);
    setShowForm(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingBanner(banner);
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
          <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Broadcast announcements shown at the top of the community feed.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No banners yet
          </p>
          <p className="text-xs text-muted-foreground">
            Create one to broadcast an announcement to all users.
          </p>
          <Button onClick={openCreate} variant="outline" size="sm" className="mt-1 gap-2">
            <Plus className="h-3.5 w-3.5" />
            New Banner
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{b.title}</span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${VARIANT_BADGE_STYLES[b.variant] ?? VARIANT_BADGE_STYLES.info}`}
                  >
                    {VARIANT_LABELS[b.variant] ?? b.variant}
                  </Badge>
                  {!b.isActive && (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                  {b.expiresAt && new Date(b.expiresAt) < new Date() && (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      Expired
                    </Badge>
                  )}
                </div>
                {b.body && (
                  <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2">
                    {b.body}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {b.ctaLabel && b.ctaUrl && (
                    <a
                      href={b.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {b.ctaLabel}
                    </a>
                  )}
                  {b.expiresAt && (
                    <span>
                      Expires {new Date(b.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  <span>
                    Created {new Date(b.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={b.isActive}
                    onCheckedChange={(v) => handleToggle(b.id, v)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(b)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeletingId(b.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BannerFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingBanner(null);
        }}
        banner={editingBanner}
        onSave={() =>
          queryClient.invalidateQueries({ queryKey: BANNERS_QUERY_KEY })
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
            <DialogTitle>Delete this banner?</DialogTitle>
            <DialogDescription>
              This cannot be undone. All dismissal records will also be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
