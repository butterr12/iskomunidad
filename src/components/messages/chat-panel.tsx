"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMessages,
  sendMessage,
  markAsRead,
  type MessageData,
  type ConversationPreview,
} from "@/actions/messages";
import { useSocket } from "@/components/providers/socket-provider";
import { MessageBubble } from "./message-bubble";
import { RequestBanner } from "./request-banner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Send,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { UserFlairs } from "@/components/user-flairs";
import { BorderedAvatar } from "@/components/bordered-avatar";
import { toast } from "sonner";
import { compressImageForUpload } from "@/lib/image-compression";
import {
  ALLOWED_IMAGE_TYPES_LABEL,
  IMAGE_UPLOAD_ACCEPT,
  isAllowedImageType,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-upload";

type OptimisticMessage = MessageData & {
  _optimistic: true;
  _tempId: string;
  _status: "sending" | "failed";
  _imagePreviewUrl?: string;
  _imageFile?: File;
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ChatPanel({
  conversation,
  onBack,
}: {
  conversation: ConversationPreview;
  onBack: () => void;
}) {
  const { data: session } = useSession();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const [messageText, setMessageText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const optimisticMessagesRef = useRef(optimisticMessages);
  optimisticMessagesRef.current = optimisticMessages;
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [readBy, setReadBy] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadOlderRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const hasInitialAutoScrollRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typingIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["messages", conversation.id],
    queryFn: async ({ pageParam }) => {
      const res = await getMessages(conversation.id, pageParam);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
  });

  const allMessages =
    data?.pages.flatMap((p) => p.messages).reduce((acc, msg) => {
      // Deduplicate messages
      if (!acc.find((m) => m.id === msg.id)) acc.push(msg);
      return acc;
    }, [] as MessageData[]) ?? [];

  // Sort by createdAt ascending
  allMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Hide mobile bottom nav while chat panel is open
  useEffect(() => {
    document.documentElement.setAttribute("data-chat-active", "");
    return () => {
      document.documentElement.removeAttribute("data-chat-active");
    };
  }, []);

  // Auto-scroll to latest message (instant on first paint, smooth afterwards)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Track whether the user is near the bottom so we only autoscroll when appropriate.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateStickiness = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 120;
    };

    updateStickiness();
    container.addEventListener("scroll", updateStickiness, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateStickiness);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const hasDisplayMessages = allMessages.length > 0 || optimisticMessages.length > 0;
    if (!hasDisplayMessages) return;
    if (!shouldStickToBottomRef.current && hasInitialAutoScrollRef.current) return;

    scrollToBottom(hasInitialAutoScrollRef.current ? "smooth" : "auto");
    hasInitialAutoScrollRef.current = true;
  }, [isLoading, allMessages.length, optimisticMessages.length, scrollToBottom]);

  // Join conversation room
  useEffect(() => {
    if (!socket || !conversation.id) return;

    const joinRoom = () => {
      socket.emit("join_conversation", conversation.id);
    };

    joinRoom();
    socket.on("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
      socket.emit("leave_conversation", conversation.id);
    };
  }, [socket, conversation.id]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: MessageData) => {
      if (msg.conversationId === conversation.id) {
        queryClient.setQueryData(
          ["messages", conversation.id],
          (old: typeof data) => {
            if (!old) return old;
            const lastPage = old.pages[old.pages.length - 1];
            // Add to last page if not already there
            if (lastPage.messages.find((m) => m.id === msg.id)) return old;
            return {
              ...old,
              pages: [
                ...old.pages.slice(0, -1),
                {
                  ...lastPage,
                  messages: [...lastPage.messages, msg],
                },
              ],
            };
          },
        );
        // Optimistic removal is handled by the HTTP response in fireAndForgetSend
        // Mark as read if it's from the other user
        if (msg.senderId !== userId) {
          void markAsRead(conversation.id);
        }
      }
    };

    const handleTyping = (data: {
      conversationId: string;
      userName: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId === conversation.id) {
        if (data.isTyping) {
          setTypingUser(data.userName);
          // Clear after 3 seconds
          if (typingIndicatorTimeoutRef.current) {
            clearTimeout(typingIndicatorTimeoutRef.current);
          }
          typingIndicatorTimeoutRef.current = setTimeout(() => {
            setTypingUser(null);
          }, 3000);
        } else {
          setTypingUser(null);
        }
      }
    };

    const handleMessageRead = (data: {
      conversationId: string;
      userId: string;
    }) => {
      if (data.conversationId === conversation.id && data.userId !== userId) {
        setReadBy(conversation.otherUser.name);
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("message_read", handleMessageRead);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("message_read", handleMessageRead);
    };
  }, [socket, conversation.id, conversation.otherUser.name, userId, queryClient, data]);

  // Mark as read on open
  useEffect(() => {
    if (conversation.unreadCount > 0) {
      void markAsRead(conversation.id);
    }
  }, [conversation.id, conversation.unreadCount]);

  // Cleanup remaining blob URLs on unmount
  useEffect(() => {
    return () => {
      optimisticMessagesRef.current.forEach((om) => {
        if (om._imagePreviewUrl) URL.revokeObjectURL(om._imagePreviewUrl);
      });
    };
  }, []);

  // Auto-fetch older messages on scroll (IntersectionObserver)
  useEffect(() => {
    if (!loadOlderRef.current || !hasNextPage) return;
    const el = loadOlderRef.current;
    const container = scrollContainerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          // Save scroll position before fetch
          const prevHeight = container?.scrollHeight ?? 0;
          fetchNextPage().then(() => {
            // Restore scroll position after new messages prepend
            requestAnimationFrame(() => {
              if (container) {
                const newHeight = container.scrollHeight;
                container.scrollTop += newHeight - prevHeight;
              }
            });
          });
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle typing events
  const handleTypingStart = useCallback(() => {
    if (!socket) return;
    socket.emit("typing_start", conversation.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing_stop", conversation.id);
    }, 2000);
  }, [socket, conversation.id]);

  // Handle image selection
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!isAllowedImageType(selectedFile.type)) {
      toast.error(`Only ${ALLOWED_IMAGE_TYPES_LABEL} images are supported`);
      e.target.value = "";
      return;
    }

    setProcessingImage(true);
    try {
      const file = await compressImageForUpload(selectedFile);
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error("Image must be under 5MB");
        return;
      }

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } catch {
      toast.error("Could not process image");
    } finally {
      setProcessingImage(false);
      e.target.value = "";
    }
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function fireAndForgetSend(om: OptimisticMessage) {
    let imageUrl: string | undefined;

    // Upload image if present
    if (om._imageFile) {
      const formData = new FormData();
      formData.append("file", om._imageFile);
      try {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.key;
      } catch {
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m._tempId === om._tempId ? { ...m, _status: "failed" as const } : m,
          ),
        );
        return;
      }
    }

    try {
      const res = await sendMessage({
        conversationId: conversation.id,
        body: om.body || undefined,
        imageUrl,
      });

      if (!res.success) {
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m._tempId === om._tempId ? { ...m, _status: "failed" as const } : m,
          ),
        );
      } else {
        // Insert confirmed message into cache before removing optimistic to avoid flash
        queryClient.setQueryData(
          ["messages", conversation.id],
          (old: typeof data) => {
            if (!old) return old;
            const lastPage = old.pages[old.pages.length - 1];
            if (lastPage.messages.find((m) => m.id === res.data.id)) return old;
            return {
              ...old,
              pages: [
                ...old.pages.slice(0, -1),
                {
                  ...lastPage,
                  messages: [...lastPage.messages, res.data],
                },
              ],
            };
          },
        );
        // Remove optimistic message and revoke blob URL
        setOptimisticMessages((prev) => {
          const idx = prev.findIndex((m) => m._tempId === om._tempId);
          if (idx === -1) return prev;
          const removed = prev[idx];
          if (removed._imagePreviewUrl) URL.revokeObjectURL(removed._imagePreviewUrl);
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
      }
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m._tempId === om._tempId ? { ...m, _status: "failed" as const } : m,
        ),
      );
    }
  }

  function handleSend() {
    const body = messageText.trim();
    if (!body && !imageFile) return;

    shouldStickToBottomRef.current = true;

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();

    const om: OptimisticMessage = {
      id: tempId,
      conversationId: conversation.id,
      senderId: userId ?? null,
      body: body || null,
      imageUrl: null,
      createdAt: now,
      sender: session?.user
        ? {
            id: session.user.id,
            name: session.user.name ?? "",
            username: (session.user as Record<string, unknown>).username as string | null ?? null,
            image: session.user.image ?? null,
          }
        : null,
      _optimistic: true,
      _tempId: tempId,
      _status: "sending",
      _imagePreviewUrl: imagePreview ?? undefined,
      _imageFile: imageFile ?? undefined,
    };

    // Add to optimistic queue immediately
    setOptimisticMessages((prev) => [...prev, om]);

    // Clear input right away so user can keep typing (don't revoke blob — optimistic msg needs it)
    setMessageText("");
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    textareaRef.current?.focus();

    // Stop typing indicator
    if (socket) {
      socket.emit("typing_stop", conversation.id);
    }

    // Fire and forget
    void fireAndForgetSend(om);
  }

  function handleRetry(tempId: string) {
    const om = optimisticMessages.find((m) => m._tempId === tempId);
    if (!om) return;
    setOptimisticMessages((prev) =>
      prev.map((m) =>
        m._tempId === tempId ? { ...m, _status: "sending" as const } : m,
      ),
    );
    void fireAndForgetSend({ ...om, _status: "sending" });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Determine if the user can send messages
  const isRequest = conversation.isRequest;
  const isRequester = conversation.requestFromUserId === userId;
  const isRecipient = conversation.requestToUserId === userId;
  const requestStatus = conversation.requestStatus;
  const canSend =
    !isRequest ||
    (isRequester && allMessages.length === 0) ||
    requestStatus === "accepted";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="sm:hidden">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BorderedAvatar avatarSize={24}>
          <Avatar size="sm">
            <AvatarImage
              src={conversation.otherUser.image ?? undefined}
              alt={conversation.otherUser.name}
            />
            <AvatarFallback className="text-xs">
              {getInitials(conversation.otherUser.name)}
            </AvatarFallback>
          </Avatar>
        </BorderedAvatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">
              {conversation.otherUser.name}
            </p>
            {conversation.otherUser.username && (
              <UserFlairs username={conversation.otherUser.username} context="inline" max={2} />
            )}
          </div>
          {conversation.otherUser.username && (
            <p className="text-xs text-muted-foreground truncate">
              @{conversation.otherUser.username}
            </p>
          )}
        </div>
      </div>

      {/* Request banner */}
      {isRequest && requestStatus !== "accepted" && (
        <RequestBanner
          conversationId={conversation.id}
          isRecipient={isRecipient}
          requesterName={conversation.otherUser.name}
          status={requestStatus}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto py-3"
      >
        {hasNextPage && (
          <div ref={loadOlderRef} className="flex justify-center py-2">
            {isFetchingNextPage && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3 px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <Skeleton className="h-10 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (() => {
          // Merge confirmed messages with optimistic ones, deduplicating
          const pendingOptimistic = optimisticMessages.filter(
            (om) => !allMessages.some((m) => m.id === om.id),
          );
          const displayMessages = [...allMessages, ...pendingOptimistic];
          displayMessages.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          if (displayMessages.length === 0) {
            return (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No messages yet. Say hello!
                </p>
              </div>
            );
          }

          return displayMessages.map((msg, i) => {
            const isOwn = msg.senderId === userId;
            const nextMsg = i < displayMessages.length - 1 ? displayMessages[i + 1] : null;
            const showAvatar = !nextMsg || nextMsg.senderId !== msg.senderId;
            const isOptimistic = "_optimistic" in msg;
            const optimisticMsg = isOptimistic ? (msg as OptimisticMessage) : null;
            return (
              <MessageBubble
                key={isOptimistic ? (msg as OptimisticMessage)._tempId : msg.id}
                message={msg}
                isOwn={isOwn}
                showAvatar={showAvatar}
                status={optimisticMsg?._status}
                onRetry={
                  optimisticMsg?._status === "failed"
                    ? () => handleRetry(optimisticMsg._tempId)
                    : undefined
                }
                imagePreviewUrl={optimisticMsg?._imagePreviewUrl}
              />
            );
          });
        })()}

        {/* Typing indicator */}
        {typingUser && (
          <div className="px-4 py-1">
            <span className="text-xs text-muted-foreground italic">
              {typingUser} is typing...
            </span>
          </div>
        )}

        {/* Read receipt */}
        {readBy && allMessages.length > 0 && allMessages[allMessages.length - 1]?.senderId === userId && (
          <div className="px-4 py-0.5 text-right">
            <span className="text-[10px] text-muted-foreground">Seen</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="border-t px-4 py-2">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 rounded-lg object-cover"
            />
            <button
              onClick={clearImage}
              className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {canSend && (
        <div className="border-t px-4 py-3 shrink-0">
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
              disabled={processingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              {processingImage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </Button>
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                handleTypingStart();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              style={{ maxHeight: 120 }}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSend}
              disabled={processingImage || (!messageText.trim() && !imageFile)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
