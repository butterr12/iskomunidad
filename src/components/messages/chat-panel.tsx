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
import { toast } from "sonner";

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
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [readBy, setReadBy] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length, scrollToBottom]);

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
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Only JPEG, PNG, WebP, and GIF images are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend() {
    if (sending) return;
    const body = messageText.trim();
    if (!body && !imageFile) return;

    setSending(true);
    let imageUrl: string | undefined;

    // Upload image if present
    if (imageFile) {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", imageFile);
      try {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          toast.error("Failed to upload image");
          setSending(false);
          setUploading(false);
          return;
        }
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.key;
      } catch {
        toast.error("Failed to upload image");
        setSending(false);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const res = await sendMessage({
      conversationId: conversation.id,
      body: body || undefined,
      imageUrl,
    });

    if (res.success) {
      setMessageText("");
      clearImage();
      textareaRef.current?.focus();
      // Stop typing
      if (socket) {
        socket.emit("typing_stop", conversation.id);
      }
    } else {
      toast.error(res.error);
    }

    setSending(false);
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
        <Avatar size="sm">
          <AvatarImage
            src={conversation.otherUser.image ?? undefined}
            alt={conversation.otherUser.name}
          />
          <AvatarFallback className="text-xs">
            {getInitials(conversation.otherUser.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {conversation.otherUser.name}
          </p>
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
        className="flex-1 overflow-y-auto py-3"
      >
        {hasNextPage && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Load older messages"
              )}
            </Button>
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
        ) : allMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          allMessages.map((msg, i) => {
            const isOwn = msg.senderId === userId;
            const prevMsg = i > 0 ? allMessages[i - 1] : null;
            const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={isOwn}
                showAvatar={showAvatar}
              />
            );
          })
        )}

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
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <ImagePlus className="h-5 w-5" />
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
              disabled={sending || (!messageText.trim() && !imageFile)}
            >
              {sending || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
