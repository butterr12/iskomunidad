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
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  unreadCount: 0,
  refreshUnreadCount: () => {},
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
  const socketRef = useRef<Socket | null>(null);

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
    });

    newSocket.on("request_accepted", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    newSocket.on("request_declined", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [session?.session?.token, queryClient, refreshUnreadCount]);

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, unreadCount, refreshUnreadCount }}
    >
      {children}
    </SocketContext.Provider>
  );
}
