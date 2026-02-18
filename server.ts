import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { eq, and, gt } from "drizzle-orm";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

app.prepare().then(async () => {
  // Dynamic imports so env vars are available when db module loads
  const { db } = await import("./src/lib/db");
  const { session: sessionTable, user: userTable } = await import("./src/lib/auth-schema");
  const { conversationParticipant } = await import("./src/lib/schema");
  const { setIO } = await import("./src/lib/socket-server");

  async function isConversationParticipant_(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const participant = await db
      .select({ id: conversationParticipant.id })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .limit(1);

    return participant.length > 0;
  }

  const httpServer = createServer(handle);

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    cors: {
      origin: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
      credentials: true,
    },
  });

  setIO(io);

  // Auth middleware — validate Better Auth session token
  io.use(async (socket, nextFn) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return nextFn(new Error("Authentication required"));
      }

      const sessionRow = await db
        .select({
          sessionId: sessionTable.id,
          userId: sessionTable.userId,
          expiresAt: sessionTable.expiresAt,
        })
        .from(sessionTable)
        .where(
          and(
            eq(sessionTable.token, token),
            gt(sessionTable.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (sessionRow.length === 0) {
        return nextFn(new Error("Invalid or expired session"));
      }

      const userRow = await db
        .select({
          id: userTable.id,
          name: userTable.name,
          username: userTable.username,
          image: userTable.image,
          status: userTable.status,
        })
        .from(userTable)
        .where(eq(userTable.id, sessionRow[0].userId))
        .limit(1);

      if (userRow.length === 0) {
        return nextFn(new Error("User not found"));
      }

      if (userRow[0].status !== "active") {
        return nextFn(new Error("Account is not active"));
      }

      socket.data.user = userRow[0];
      nextFn();
    } catch (err) {
      console.error("[socket] Auth error:", err);
      nextFn(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user?.id as string;
    if (!userId) return;

    // Join personal notification room
    socket.join(`user:${userId}`);

    // Join a conversation room
    socket.on("join_conversation", async (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !VALID_UUID.test(conversationId)) {
        return;
      }

      if (await isConversationParticipant_(conversationId, userId)) {
        socket.join(`conv:${conversationId}`);
      }
    });

    // Leave a conversation room
    socket.on("leave_conversation", (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !VALID_UUID.test(conversationId)) {
        return;
      }
      socket.leave(`conv:${conversationId}`);
    });

    // Typing indicators
    socket.on("typing_start", async (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !VALID_UUID.test(conversationId)) {
        return;
      }

      const room = `conv:${conversationId}`;
      if (!socket.rooms.has(room)) return;
      if (!(await isConversationParticipant_(conversationId, userId))) return;

      socket.to(room).emit("typing", {
        conversationId,
        userId,
        userName: socket.data.user?.name,
        isTyping: true,
      });
    });

    socket.on("typing_stop", async (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !VALID_UUID.test(conversationId)) {
        return;
      }

      const room = `conv:${conversationId}`;
      if (!socket.rooms.has(room)) return;
      if (!(await isConversationParticipant_(conversationId, userId))) return;

      socket.to(room).emit("typing", {
        conversationId,
        userId,
        userName: socket.data.user?.name,
        isTyping: false,
      });
    });

    // Mark as read (client can also call the server action, this is for real-time broadcast)
    socket.on("mark_read", async (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !VALID_UUID.test(conversationId)) {
        return;
      }

      const room = `conv:${conversationId}`;
      if (!socket.rooms.has(room)) return;
      if (!(await isConversationParticipant_(conversationId, userId))) return;

      socket.to(room).emit("message_read", {
        conversationId,
        userId,
        readAt: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      // Cleanup handled automatically by Socket.io room management
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
