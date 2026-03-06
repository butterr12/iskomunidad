"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Ghost,
  HeartHandshake,
  Loader2,
  Send,
  ImagePlus,
  ShieldAlert,
  X,
  Flag,
  UserRoundPlus,
  MessageSquare,
} from "lucide-react";
import {
  blockCampusMatchUser,
  dequeueCampusMatch,
  declineCampusMatchConnect,
  endCampusMatchSession,
  getCampusMatchMessages,
  getCampusMatchRuntimeState,
  enqueueCampusMatch,
  reportCampusMatchUser,
  requestCampusMatchConnect,
  sendCampusMatchMessage,
  skipCampusMatchSession,
  type CampusMatchMessageData,
  type MatchScope,
} from "@/actions/campus-match";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { compressImageForUpload } from "@/lib/image-compression";
import {
  ALLOWED_IMAGE_TYPES_LABEL,
  IMAGE_UPLOAD_ACCEPT,
  isAllowedImageType,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-upload";

function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const STICKY_BOTTOM_THRESHOLD_PX = 120;

function MessageBubble({
  message,
  isOwn,
}: {
  message: CampusMatchMessageData;
  isOwn: boolean;
}) {
  const imageSrc = message.imageUrl ? `/api/photos/${message.imageUrl}` : null;

  return (
    <div className={cn("flex px-4 py-1", isOwn ? "justify-end" : "justify-start")}>
      <div className="max-w-[80%] space-y-1">
        {!isOwn && (
          <p className="px-1 text-[11px] text-muted-foreground">{message.senderAlias}</p>
        )}
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- chat image preview from uploaded key
          <img
            src={imageSrc}
            alt="Shared image"
            className="max-h-64 rounded-xl border object-cover"
          />
        )}
        {message.body && (
          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-sm break-words",
              isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            {message.body}
          </div>
        )}
        <p className={cn("px-1 text-[10px] text-muted-foreground", isOwn && "text-right")}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function CampusMatchPanel({ onBack }: { onBack?: () => void }) {
  const queryClient = useQueryClient();
  const { data: authSession } = useSession();

  const [alias, setAlias] = useState("");
  const [scope, setScope] = useState<MatchScope>("same-campus");
  const [joining, setJoining] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [sessionActionPending, setSessionActionPending] = useState<
    "connect" | "decline" | "skip" | "end" | "block" | "report" | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const forceScrollToBottomRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const pendingOlderFetchRef = useRef<{
    scrollTop: number;
    scrollHeight: number;
  } | null>(null);

  const { data: state, refetch: refetchState, isLoading: stateLoading, isError, error } = useQuery({
    queryKey: ["campus-match-state"],
    queryFn: async () => {
      const res = await getCampusMatchRuntimeState();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!state) return;
    if (state.status === "idle") {
      setAlias(state.preferences.defaultAlias ?? "");
      setScope(state.preferences.lastScope);
      return;
    }
    if (state.status === "waiting" && state.queue) {
      setAlias(state.queue.alias);
      setScope(state.queue.scope);
    }
  }, [state]);

  const sessionId = state?.session?.conversationId ?? null;
  const hasSessionActionPending = sessionActionPending !== null;

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ["campus-match-messages", sessionId],
    queryFn: async ({ pageParam }) => {
      if (!sessionId) {
        return { messages: [], nextCursor: null as string | null };
      }
      const res = await getCampusMatchMessages({
        sessionId,
        cursor: pageParam ?? undefined,
      });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!sessionId && state?.status === "in_session",
    refetchInterval: 4_000,
  });

  const allMessages = useMemo(() => {
    const merged = messagesData?.pages.flatMap((page) => page.messages) ?? [];
    const byId = new Map<string, CampusMatchMessageData>();
    for (const message of merged) {
      byId.set(message.id, message);
    }
    return [...byId.values()].sort((a, b) => {
      if (a.createdAt < b.createdAt) return -1;
      if (a.createdAt > b.createdAt) return 1;
      return a.id.localeCompare(b.id);
    });
  }, [messagesData]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const node = messagesContainerRef.current;
    const pendingOlderFetch = pendingOlderFetchRef.current;
    if (pendingOlderFetch) {
      const delta = node.scrollHeight - pendingOlderFetch.scrollHeight;
      node.scrollTop = pendingOlderFetch.scrollTop + delta;
      pendingOlderFetchRef.current = null;
      forceScrollToBottomRef.current = false;
      return;
    }

    if (forceScrollToBottomRef.current || shouldStickToBottomRef.current) {
      node.scrollTop = node.scrollHeight;
      shouldStickToBottomRef.current = true;
    }
    forceScrollToBottomRef.current = false;
  }, [allMessages.length]);

  useEffect(() => {
    pendingOlderFetchRef.current = null;
    shouldStickToBottomRef.current = true;
    forceScrollToBottomRef.current = true;
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  async function refreshEverything() {
    await refetchState();
    if (sessionId) {
      await refetchMessages();
    }
  }

  function handleMessagesScroll() {
    const node = messagesContainerRef.current;
    if (!node) return;
    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickToBottomRef.current =
      distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX;
  }

  async function handleLoadOlder() {
    const node = messagesContainerRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    pendingOlderFetchRef.current = {
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
    };
    try {
      await fetchNextPage();
    } catch {
      pendingOlderFetchRef.current = null;
      toast.error("Failed to load older messages");
    }
  }

  async function handleJoinQueue() {
    const nextAlias = alias.trim();
    if (nextAlias.length < 3) {
      toast.error("Alias must be at least 3 characters");
      return;
    }

    setJoining(true);
    const res = await enqueueCampusMatch({ alias: nextAlias, scope });
    setJoining(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    await refreshEverything();
  }

  async function handleLeaveQueue() {
    const res = await dequeueCampusMatch();
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    await refreshEverything();
  }

  async function handleConnectRequest() {
    if (!sessionId || hasSessionActionPending) return;
    setSessionActionPending("connect");
    try {
      const res = await requestCampusMatchConnect({ sessionId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await refreshEverything();
    } finally {
      setSessionActionPending(null);
    }
  }

  async function handleDeclineConnect() {
    if (!sessionId || hasSessionActionPending) return;
    setSessionActionPending("decline");
    try {
      const res = await declineCampusMatchConnect({ sessionId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Connect request cleared.");
      await refreshEverything();
    } finally {
      setSessionActionPending(null);
    }
  }

  async function handleSkipSession() {
    if (!sessionId || hasSessionActionPending) return;
    setSessionActionPending("skip");
    try {
      const res = await skipCampusMatchSession({ sessionId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Skipped this chat and rejoined queue.");
      await refreshEverything();
    } finally {
      setSessionActionPending(null);
    }
  }

  async function handleEndSession() {
    if (!sessionId || hasSessionActionPending) return;
    setSessionActionPending("end");
    try {
      const res = await endCampusMatchSession({ sessionId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Chat ended.");
      await refreshEverything();
    } finally {
      setSessionActionPending(null);
    }
  }

  async function handleReportUser() {
    if (!sessionId || hasSessionActionPending) return;
    const reason = reportReason.trim();
    if (!reason) {
      toast.error("Please provide a reason");
      return;
    }

    setSessionActionPending("report");
    try {
      const res = await reportCampusMatchUser({ sessionId, reason });
      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setReportDialogOpen(false);
      setReportReason("");
      toast.success("Report submitted. Chat ended.");
      await refreshEverything();
    } finally {
      setSessionActionPending(null);
    }
  }

  async function handleBlockUser() {
    if (!sessionId || hasSessionActionPending) return;
    setSessionActionPending("block");
    try {
      const res = await blockCampusMatchUser({ sessionId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setBlockDialogOpen(false);
      toast.success("User blocked. Chat ended.");
      await refreshEverything();
    } finally {
      setSessionActionPending(null);
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!isAllowedImageType(selectedFile.type)) {
      toast.error(`Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES_LABEL}`);
      e.currentTarget.value = "";
      return;
    }

    setProcessingImage(true);

    try {
      const file = await compressImageForUpload(selectedFile);
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error("Image is too large. Please upload one under 5MB.");
        return;
      }

      setImageFile(file);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(URL.createObjectURL(file));
    } catch {
      toast.error("Failed to process image");
    } finally {
      setProcessingImage(false);
      e.currentTarget.value = "";
    }
  }

  function clearImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSendMessage() {
    if (!sessionId) return;

    const body = messageText.trim();
    if (!body && !imageFile) return;

    setSendingMessage(true);

    let imageUrl: string | undefined;
    if (imageFile) {
      const formData = new FormData();
      formData.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        setSendingMessage(false);
        toast.error("Failed to upload image");
        return;
      }
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.key;
    }

    const res = await sendCampusMatchMessage({
      sessionId,
      body: body || undefined,
      imageUrl,
    });

    setSendingMessage(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    setMessageText("");
    clearImage();
    forceScrollToBottomRef.current = true;

    await queryClient.invalidateQueries({
      queryKey: ["campus-match-messages", sessionId],
    });
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Failed to load Campus Match"}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetchState()}>
          Try again
        </Button>
      </div>
    );
  }

  if (stateLoading || !state) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="sm:hidden">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to inbox</span>
          </Button>
        )}
        <HeartHandshake className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Campus Match</p>
        {state.status === "in_session" && (
          <Badge variant="secondary" className="ml-auto">
            Live
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {state.status === "banned" && state.ban && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Temporarily Unavailable
              </CardTitle>
              <CardDescription>
                Campus Match access is temporarily restricted for your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Ban expires: <span className="font-medium">{new Date(state.ban.expiresAt).toLocaleString()}</span>
              </p>
              {state.ban.reason && (
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Reason: {state.ban.reason}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {state.status === "idle" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Find an anonymous match</CardTitle>
              <CardDescription>
                Choose your alias and scope, then join the queue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="campus-match-alias">Alias</Label>
                <Input
                  id="campus-match-alias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g. Midnight Isko"
                  maxLength={24}
                />
                <p className="text-xs text-muted-foreground">3-24 characters, letters/numbers/spaces.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Scope</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={scope === "same-campus" ? "default" : "outline"}
                    onClick={() => setScope("same-campus")}
                  >
                    Same campus
                  </Button>
                  <Button
                    type="button"
                    variant={scope === "all-campuses" ? "default" : "outline"}
                    onClick={() => setScope("all-campuses")}
                  >
                    All campuses
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Same campus requires your university to be set in Settings.
                </p>
              </div>

              <Button className="w-full" onClick={handleJoinQueue} disabled={joining}>
                {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ghost className="mr-2 h-4 w-4" />}
                Join queue
              </Button>
            </CardContent>
          </Card>
        )}

        {state.status === "waiting" && state.queue && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Looking for a match</CardTitle>
              <CardDescription>
                We match as soon as an eligible user is available. We keep your queue presence alive automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Alias</span>
                <span className="font-medium">{state.queue.alias}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Scope</span>
                <span className="font-medium">
                  {state.queue.scope === "same-campus" ? "Same campus" : "All campuses"}
                </span>
              </div>
              <Button variant="outline" className="w-full" onClick={handleLeaveQueue}>
                Leave queue
              </Button>
            </CardContent>
          </Card>
        )}

        {state.status === "in_session" && state.session && (
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Talking with {state.session.partnerAlias}</p>
                  <p className="text-xs text-muted-foreground">
                    You are {state.session.myAlias}. Identity reveals only if both connect.
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {state.session.connectState.replace("_", " ")}
                </Badge>
              </div>
              {state.session.connectState === "pending_them" && (
                <p className="mt-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                  The other user requested to connect.
                </p>
              )}
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="min-h-0 flex-1 overflow-y-auto py-2"
            >
              {hasNextPage && allMessages.length > 0 && (
                <div className="flex justify-center pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleLoadOlder()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Load older
                  </Button>
                </div>
              )}

              {allMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  <div>
                    <MessageSquare className="mx-auto mb-2 h-5 w-5" />
                    No messages yet. Say hi.
                  </div>
                </div>
              ) : (
                allMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === authSession?.user?.id}
                  />
                ))
              )}
            </div>

            {imagePreviewUrl && (
              <div className="border-t px-4 py-2">
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={imagePreviewUrl} alt="Preview" className="h-20 rounded-lg object-cover" />
                  <button
                    onClick={clearImage}
                    aria-label="Remove selected image"
                    className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            <div className="border-t px-4 py-3">
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Attach image"
                  disabled={processingImage || sendingMessage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {processingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </Button>
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message"
                  rows={1}
                  className="min-h-9 resize-none"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Send message"
                  disabled={sendingMessage || (!messageText.trim() && !imageFile)}
                  onClick={() => void handleSendMessage()}
                >
                  {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="border-t px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  onClick={() => void handleConnectRequest()}
                  className="gap-1"
                  disabled={
                    hasSessionActionPending ||
                    state.session.connectState === "pending_me" ||
                    state.session.connectState === "mutual"
                  }
                >
                  <UserRoundPlus className="h-4 w-4" />
                  {state.session.connectState === "pending_them" ? "Accept Connect" : "Connect"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleDeclineConnect()}
                  disabled={
                    hasSessionActionPending ||
                    state.session.connectState === "none" ||
                    state.session.connectState === "mutual"
                  }
                >
                  Decline
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleSkipSession()}
                  disabled={hasSessionActionPending}
                >
                  Skip + requeue
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleEndSession()}
                  disabled={hasSessionActionPending}
                >
                  End chat
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setBlockDialogOpen(true)}
                  disabled={hasSessionActionPending}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Block
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setReportDialogOpen(true)}
                  disabled={hasSessionActionPending}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Report
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block user</DialogTitle>
            <DialogDescription>
              Blocking ends this session and prevents future matches with this user.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlockDialogOpen(false)}
              disabled={hasSessionActionPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleBlockUser()}
              disabled={hasSessionActionPending}
            >
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report user</DialogTitle>
            <DialogDescription>
              Reporting ends this session immediately and sends it to admins for review.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Describe what happened"
            rows={4}
            maxLength={500}
            disabled={hasSessionActionPending}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportDialogOpen(false)}
              disabled={hasSessionActionPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReportUser()}
              disabled={hasSessionActionPending || !reportReason.trim()}
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
