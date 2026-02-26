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

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  unreadCount: number;
  refreshUnreadCount: () => void;
  activeUserIds: Set<string>;
};

const EMPTY_SET = new Set<string>();

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  unreadCount: 0,
  refreshUnreadCount: () => {},
  activeUserIds: EMPTY_SET,
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
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(EMPTY_SET);
  const socketRef = useRef<Socket | null>(null);
  const removalTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const refreshUnreadCount = useCallback(async () => {
    const res = await getUnreadCount();
    if (res.success) {
      setUnreadCount(res.data);
    }
  }, []);

  useEffect(() => {
    const token = session?.session?.token;
    if (!token) {
      const existingSocket = socketRef.current;
      socketRef.current = null;
      if (existingSocket) {
        existingSocket.disconnect();
      }
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

    newSocket.on("conversation_updated", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void refreshUnreadCount();
    });

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
    };
  }, [session?.session?.token, queryClient, refreshUnreadCount]);

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, unreadCount, refreshUnreadCount, activeUserIds }}
    >
      {children}
    </SocketContext.Provider>
  );
}
