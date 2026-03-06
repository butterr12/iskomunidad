"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/shared/star-rating";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createReview, updateReview } from "@/actions/landmarks";
import type { LandmarkReview } from "@/lib/landmarks";

interface ReviewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landmarkId: string;
  landmarkName: string;
  editReview?: LandmarkReview | null;
}

export function ReviewForm({
  open,
  onOpenChange,
  landmarkId,
  landmarkName,
  editReview,
}: ReviewFormProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(editReview?.rating ?? 0);
  const [body, setBody] = useState(editReview?.body ?? "");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editReview;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateReview({
            reviewId: editReview.id,
            rating,
            body: body.trim() || undefined,
          })
        : await createReview({
            landmarkId,
            rating,
            body: body.trim() || undefined,
          });

      if (result.success) {
        toast.success(isEdit ? "Review updated" : "Review posted");
        await queryClient.invalidateQueries({
          queryKey: ["landmark-detail", landmarkId],
        });
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
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit Review" : `Review ${landmarkName}`}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">How would you rate this place?</p>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>

          <Textarea
            placeholder="Share your experience (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
          />

          <Button type="submit" className="w-full" disabled={submitting || rating === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update Review" : "Post Review"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
