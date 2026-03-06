"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { getUnreadCount } from "@/actions/messages";
import {
  getCampusMatchRuntimeState,
  touchCampusMatchPresence,
} from "@/actions/campus-match";
import { toast } from "sonner";

export type MessageNotification = {
  senderName: string;
  senderImage: string | null;
  messagePreview: string;
  conversationId: string;
};

export type CampusMatchStateSnapshot = {
  status: "idle" | "waiting" | "in_session" | "banned";
  preferences: {
    allowAnonQueue: boolean;
    defaultAlias: string | null;
    lastScope: "same-campus" | "all-campuses";
  };
  queue: null | {
    scope: "same-campus" | "all-campuses";
    alias: string;
    waitingSince: string;
  };
  session: null | {
    conversationId: string;
    sessionStatus: "active" | "ended" | "promoted";
    myAlias: string;
    partnerAlias: string;
    connectState: "none" | "pending_me" | "pending_them" | "mutual";
  };
  ban: null | {
    expiresAt: string;
    reason: string | null;
  };
};

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  unreadCount: number;
  refreshUnreadCount: () => void;
  campusMatchState: CampusMatchStateSnapshot | null;
  refreshCampusMatchState: () => void;
  activeUserIds: Set<string>;
  setActiveConversationId: (id: string | null) => void;
  messageNotification: MessageNotification | null;
  dismissNotification: () => void;
};

const EMPTY_SET = new Set<string>();
const TERMINAL_CAMPUS_MATCH_ERRORS = new Set([
  "Not authenticated",
  "Campus Match is currently disabled",
]);

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  unreadCount: 0,
  refreshUnreadCount: () => {},
  campusMatchState: null,
  refreshCampusMatchState: () => {},
  activeUserIds: EMPTY_SET,
  setActiveConversationId: () => {},
  messageNotification: null,
  dismissNotification: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [campusMatchState, setCampusMatchState] =
    useState<CampusMatchStateSnapshot | null>(null);
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(EMPTY_SET);
  const [messageNotification, setMessageNotification] =
    useState<MessageNotification | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const removalTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const activeConversationIdRef = useRef<string | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setActiveConversationId = useCallback((id: string | null) => {
    activeConversationIdRef.current = id;
  }, []);

  const dismissNotification = useCallback(() => {
    setMessageNotification(null);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    const res = await getUnreadCount();
    if (res.success) {
      setUnreadCount(res.data);
    }
  }, []);

  const clearCampusMatchState = useCallback(() => {
    setCampusMatchState(null);
    void queryClient.setQueryData(["campus-match-state"], null);
  }, [queryClient]);

  const refreshCampusMatchState = useCallback(async () => {
    try {
      const res = await getCampusMatchRuntimeState();
      if (res.success) {
        setCampusMatchState(res.data);
        void queryClient.setQueryData(["campus-match-state"], res.data);
        return;
      }

      // Clear only on terminal auth/feature-off states.
      if (TERMINAL_CAMPUS_MATCH_ERRORS.has(res.error)) {
        clearCampusMatchState();
      }
    } catch {
      // Keep last known state on transient transport/runtime failures.
    }
  }, [queryClient, clearCampusMatchState]);

  const touchCampusMatchHeartbeat = useCallback(async () => {
    const res = await touchCampusMatchPresence();
    if (!res.success) {
      // If presence touch fails, force a state refresh so UI/heartbeat can self-correct quickly.
      void refreshCampusMatchState();
    }
  }, [refreshCampusMatchState]);

  useEffect(() => {
    const token = session?.session?.token;
    if (!token) {
      const existingSocket = socketRef.current;
      socketRef.current = null;
      if (existingSocket) {
        existingSocket.disconnect();
      }
      queueMicrotask(() => {
        clearCampusMatchState();
      });
      return;
    }

    const newSocket = io({
      path: "/api/socketio",
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
      setSocket(newSocket);
      // Refresh data on connect/reconnect
      void refreshUnreadCount();
      void refreshCampusMatchState();
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      if (socketRef.current === null) {
        setSocket(null);
      }
    });

    // Handle new messages — refresh conversations and unread count
    newSocket.on("new_message", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void refreshUnreadCount();
    });

    newSocket.on(
      "conversation_updated",
      (payload: {
        conversationId: string;
        message?: {
          body: string | null;
          imageUrl: string | null;
          sender: { name: string; image: string | null } | null;
        };
      }) => {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        void refreshUnreadCount();

        // Show notification banner if not viewing this conversation
        if (
          payload.message?.sender &&
          activeConversationIdRef.current !== payload.conversationId
        ) {
          const preview =
            payload.message.imageUrl && !payload.message.body
              ? "Sent a photo"
              : payload.message.body?.slice(0, 80) ?? "New message";

          if (notificationTimeoutRef.current) {
            clearTimeout(notificationTimeoutRef.current);
          }

          setMessageNotification({
            senderName: payload.message.sender.name,
            senderImage: payload.message.sender.image,
            messagePreview: preview,
            conversationId: payload.conversationId,
          });

          notificationTimeoutRef.current = setTimeout(() => {
            setMessageNotification(null);
            notificationTimeoutRef.current = null;
          }, 4000);
        }
      },
    );

    newSocket.on("new_request", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void refreshUnreadCount();
    });

    newSocket.on("request_accepted", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void refreshUnreadCount();
    });

    newSocket.on("request_declined", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void refreshUnreadCount();
    });

    newSocket.on("request_deleted", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void refreshUnreadCount();
    });

    newSocket.on("conversation_deleted", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void refreshUnreadCount();
    });

    const refreshCampusMatch = () => {
      void refreshCampusMatchState();
      void queryClient.invalidateQueries({ queryKey: ["campus-match-state"] });
    };

    newSocket.on("campus_match_state_changed", refreshCampusMatch);
    newSocket.on("campus_match_session_ended", refreshCampusMatch);
    newSocket.on("campus_match_connect_changed", refreshCampusMatch);

    newSocket.on("campus_match_message", (payload: { sessionId?: string }) => {
      refreshCampusMatch();
      if (payload.sessionId) {
        void queryClient.invalidateQueries({
          queryKey: ["campus-match-messages", payload.sessionId],
        });
      }
    });

    newSocket.on("campus_match_found", (payload: { sessionId?: string }) => {
      refreshCampusMatch();
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      const params =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const isAlreadyInAnon = pathname === "/messages" && params?.get("tab") === "anon";
      if (!isAlreadyInAnon) {
        toast("Campus Match found", {
          description: "Open your anonymous chat now.",
          action: {
            label: "Open chat",
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.href = "/messages?tab=anon";
              }
            },
          },
        });
      }
      if (payload.sessionId) {
        void queryClient.invalidateQueries({
          queryKey: ["campus-match-messages", payload.sessionId],
        });
      }
    });

    newSocket.on(
      "campus_match_promoted",
      (payload: { conversationId?: string; sessionId?: string }) => {
        refreshCampusMatch();
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        void refreshUnreadCount();
        const conversationId = payload.conversationId ?? payload.sessionId;
        if (!conversationId) return;

        const pathname = typeof window !== "undefined" ? window.location.pathname : "";
        const params =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const activeChat = params?.get("chat");
        const isAlreadyViewingPromoted =
          pathname === "/messages" && activeChat === conversationId;

        if (!isAlreadyViewingPromoted) {
          toast.success("Campus Match connected! Opening your conversation...");
          if (typeof window !== "undefined") {
            window.location.href = `/messages?chat=${conversationId}`;
          }
        }
      },
    );

    // Presence events
    newSocket.on("presence_sync", (data: { onlineUserIds: string[] }) => {
      // Clear all pending removal timeouts — the server's snapshot is authoritative
      for (const timeout of removalTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      removalTimeoutsRef.current.clear();
      setActiveUserIds(new Set(data.onlineUserIds));
    });

    newSocket.on("user_online", (data: { userId: string }) => {
      // Clear any pending removal timeout
      const existing = removalTimeoutsRef.current.get(data.userId);
      if (existing) {
        clearTimeout(existing);
        removalTimeoutsRef.current.delete(data.userId);
      }
      setActiveUserIds((prev) => {
        if (prev.has(data.userId)) return prev;
        const next = new Set(prev);
        next.add(data.userId);
        return next;
      });
    });

    newSocket.on("user_offline", (data: { userId: string }) => {
      // Clear any existing timeout for this user before setting a new one
      const existing = removalTimeoutsRef.current.get(data.userId);
      if (existing) clearTimeout(existing);
      // Delay removal by 3 minutes to prevent flicker on page refresh
      const timeout = setTimeout(() => {
        removalTimeoutsRef.current.delete(data.userId);
        setActiveUserIds((prev) => {
          if (!prev.has(data.userId)) return prev;
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }, 3 * 60 * 1000);
      removalTimeoutsRef.current.set(data.userId, timeout);
    });

    socketRef.current = newSocket;
    const timeouts = removalTimeoutsRef.current;

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      // Clear all pending removal timeouts
      for (const timeout of timeouts.values()) {
        clearTimeout(timeout);
      }
      timeouts.clear();
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }
    };
  }, [session?.session?.token, queryClient, refreshUnreadCount, refreshCampusMatchState, clearCampusMatchState]);

  // Periodic runtime-state sync: protects queue/session UI from missed socket events.
  useEffect(() => {
    const token = session?.session?.token;
    if (!token) return;

    const initialTimeout = setTimeout(() => {
      void refreshCampusMatchState();
    }, 0);
    const id = setInterval(() => {
      void refreshCampusMatchState();
    }, 60_000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(id);
    };
  }, [session?.session?.token, refreshCampusMatchState]);

  // Global heartbeat: keeps queue entry alive even when panel is not mounted
  useEffect(() => {
    if (campusMatchState?.status !== "waiting") return;

    const initialTimeout = setTimeout(() => {
      void touchCampusMatchHeartbeat();
    }, 0);
    const id = setInterval(() => {
      void touchCampusMatchHeartbeat();
    }, 30_000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(id);
    };
  }, [campusMatchState?.status, touchCampusMatchHeartbeat]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        unreadCount,
        refreshUnreadCount,
        campusMatchState,
        refreshCampusMatchState,
        activeUserIds,
        setActiveConversationId,
        messageNotification,
        dismissNotification,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
