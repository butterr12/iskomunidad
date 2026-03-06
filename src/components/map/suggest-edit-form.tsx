"use client";

import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { suggestLandmarkEdit } from "@/actions/landmarks";
import type { Landmark } from "@/lib/landmarks";

interface SuggestEditFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landmark: Landmark;
}

export function SuggestEditForm({
  open,
  onOpenChange,
  landmark,
}: SuggestEditFormProps) {
  const [name, setName] = useState(landmark.name);
  const [description, setDescription] = useState(landmark.description);
  const [address, setAddress] = useState(landmark.address ?? "");
  const [phone, setPhone] = useState(landmark.phone ?? "");
  const [website, setWebsite] = useState(landmark.website ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const changes = useMemo(() => {
    const diff: Record<string, unknown> = {};
    if (name !== landmark.name) diff.name = name;
    if (description !== landmark.description) diff.description = description;
    if (address !== (landmark.address ?? "")) diff.address = address || null;
    if (phone !== (landmark.phone ?? "")) diff.phone = phone || null;
    if (website !== (landmark.website ?? "")) diff.website = website || null;
    return diff;
  }, [name, description, address, phone, website, landmark]);

  const hasChanges = Object.keys(changes).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;

    setSubmitting(true);
    try {
      const result = await suggestLandmarkEdit({
        landmarkId: landmark.id,
        changes,
        note: note.trim() || undefined,
      });

      if (result.success) {
        toast.success("Your suggestion will be reviewed by an admin.");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Suggest an Edit</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address">Address</Label>
            <Input
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-note">Note for reviewer (optional)</Label>
            <Textarea
              id="edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Why are you suggesting this change?"
              maxLength={500}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || !hasChanges}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Suggestion
          </Button>

          {!hasChanges && (
            <p className="text-center text-xs text-muted-foreground">
              Make a change to enable submission
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
