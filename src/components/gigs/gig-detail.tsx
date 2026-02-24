"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  DollarSign,
  MapPin,
  CalendarDays,
  User,
  GraduationCap,
  MessageCircle,
  Users,
  Share2,
  Bookmark,
  HandHelping,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site-config";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  formatRelativeTime,
  type GigListing,
} from "@/lib/gigs";
import { getOrCreateConversation, sendMessage } from "@/actions/messages";

interface GigDetailProps {
  gig: GigListing;
  onBack: () => void;
  isOwner: boolean;
  onInterest: () => void;
  isInterested: boolean;
  onSave: () => void;
  isSaved: boolean;
  isSaving: boolean;
}

export function GigDetail({
  gig,
  onBack,
  isOwner,
  onInterest,
  isInterested,
  onSave,
  isSaved,
  isSaving,
}: GigDetailProps) {
  const router = useRouter();
  const [showCompose, setShowCompose] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentConversationId, setSentConversationId] = useState<string | null>(null);

  const systemPart = `📋 About this gig: "${gig.title}" · ${gig.compensation} · ${CATEGORY_LABELS[gig.category]}`;

  const handleShare = async () => {
    const url = `${siteConfig.url}/gigs?gig=${gig.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: gig.title, url }); return; }
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); toast.success("Link copied to clipboard."); return; }
      toast.error("Sharing is not supported on this device.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("Could not share this gig.");
    }
  };

  function openCompose() {
    setUserMessage("Hi! I saw your gig and I'm interested in helping. Could we connect?");
    setSentConversationId(null);
    setShowCompose(true);
  }

  async function handleSendInterestMessage() {
    if (!userMessage.trim() || sending) return;
    setSending(true);
    try {
      const body = `${systemPart}\n\n${userMessage.trim()}`;
      const convResult = await getOrCreateConversation(gig.posterId);
      if (!convResult.success) {
        toast.error(convResult.error ?? "Could not start conversation");
        return;
      }
      const { conversationId } = convResult.data;
      const msgResult = await sendMessage({ conversationId, body });
      if (!msgResult.success) {
        toast.error(msgResult.error ?? "Failed to send message");
        return;
      }
      setSentConversationId(conversationId);
      onInterest();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 border-b px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Gigs
      </button>

      {/* Category accent bar */}
      <div
        className="h-3"
        style={{ backgroundColor: CATEGORY_COLORS[gig.category] }}
      />

      <div className="flex flex-col gap-4 p-5">
        {/* Title & badges */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-semibold leading-tight">{gig.title}</h2>
            {isOwner && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Your Gig
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge
              variant="secondary"
              style={{ backgroundColor: CATEGORY_COLORS[gig.category] + "20", color: CATEGORY_COLORS[gig.category] }}
            >
              {CATEGORY_LABELS[gig.category]}
            </Badge>
            <Badge
              variant="secondary"
              style={{ backgroundColor: URGENCY_COLORS[gig.urgency] + "20", color: URGENCY_COLORS[gig.urgency] }}
            >
              {URGENCY_LABELS[gig.urgency]}
            </Badge>
          </div>
        </div>

        {/* Tags */}
        {gig.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {gig.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground/80"
              >
                <span className="mr-0.5 text-muted-foreground">#</span>{tag}
              </span>
            ))}
          </div>
        )}

        {/* Info rows */}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {gig.isPaid
                ? gig.compensation.replace("PHP ", "₱").startsWith("₱")
                  ? gig.compensation.replace("PHP ", "₱")
                  : `₱${gig.compensation.replace("PHP ", "")}`
                : gig.compensation}
            </span>
          </div>
          {(gig.locationId || gig.locationNote) && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{gig.locationNote ?? "On Campus"}</span>
            </div>
          )}
          {gig.deadline && (
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Deadline:{" "}
                {new Date(gig.deadline).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {gig.posterName}{" "}
              {gig.posterHandle ? (
                <Link href={`/profile/${gig.posterHandle.replace("@", "")}`} className="text-muted-foreground/60 hover:underline">
                  {gig.posterHandle}
                </Link>
              ) : (
                <span className="text-muted-foreground/60">{gig.posterName}</span>
              )}
            </span>
          </div>
          {gig.posterCollege && (
            <div className="flex items-start gap-2">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{gig.posterCollege}</span>
            </div>
          )}
          {gig.contactMethod && gig.contactMethod !== "in-app" && (
            <div className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{gig.contactMethod}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {gig.applicantCount} {gig.applicantCount === 1 ? "applicant" : "applicants"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground/60">
            Posted {formatRelativeTime(gig.createdAt)} ago
          </div>
        </div>

        {/* Description */}
        <div className="border-t pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{gig.description}</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 border-t pt-4">
          {isOwner ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-semibold">{gig.applicantCount}</span>{" "}
                  {gig.applicantCount === 1 ? "person" : "people"} expressed interest
                </span>
              </div>
              {gig.locationId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => router.push(`/map?landmark=${gig.locationId}`)}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  View on Map
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={openCompose}
                  disabled={isInterested}
                >
                  <HandHelping className="h-3.5 w-3.5" />
                  {isInterested ? "Interested ✓" : "I'm Interested"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onSave}
                  disabled={isSaving}
                >
                  <Bookmark className={cn("h-3.5 w-3.5", isSaved && "fill-current")} />
                  {isSaved ? "Saved" : "Save"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              </div>
              {gig.locationId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => router.push(`/map?landmark=${gig.locationId}`)}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  View on Map
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DM compose dialog */}
      <Dialog
        open={showCompose}
        onOpenChange={(o) => {
          if (!sending) setShowCompose(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Message {gig.posterName}</DialogTitle>
            <DialogDescription>
              {sentConversationId
                ? "Your message was sent successfully."
                : "Send a message to express your interest in this gig."}
            </DialogDescription>
          </DialogHeader>

          {sentConversationId ? (
            <div className="flex flex-col gap-3 pt-1">
              <p className="text-sm text-muted-foreground">
                Message sent to{" "}
                <span className="font-medium">
                  {gig.posterHandle ?? gig.posterName}
                </span>
                !
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCompose(false)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push(`/messages?chat=${sentConversationId}`)}
                >
                  Open Conversation
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              {/* Non-editable system header */}
              <div className="select-none rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                {systemPart}
              </div>

              {/* Editable user message */}
              <Textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                placeholder="Write your message..."
                rows={4}
                disabled={sending}
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCompose(false)}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={sending || !userMessage.trim()}
                  onClick={handleSendInterestMessage}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Message →"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
