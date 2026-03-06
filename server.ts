import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { eq, and, gt, lt, isNull, ne, inArray } from "drizzle-orm";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

app.prepare().then(async () => {
  // Init Sentry before anything else (env vars are loaded at this point)
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    enableLogs: true,
  });

  // Dynamic imports so env vars are available when db module loads
  const { db } = await import("./src/lib/db");
  const { session: sessionTable, user: userTable } = await import("./src/lib/auth-schema");
  const { conversation, conversationParticipant } = await import("./src/lib/schema");
  const { setIO } = await import("./src/lib/socket-server");
  const { matchMatch } = await import("./src/lib/schema");

  async function isConversationParticipant_(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const participant = await db
      .select({ id: conversationParticipant.id })
      .from(conversationParticipant)
      .innerJoin(
        conversation,
        and(
          eq(conversation.id, conversationParticipant.conversationId),
          isNull(conversation.deletedAt),
        ),
      )
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .limit(1);

    return participant.length > 0;
  }

  async function getConversationPartnerIds(userId: string): Promise<string[]> {
    const userConvs = await db
      .select({ conversationId: conversationParticipant.conversationId })
      .from(conversationParticipant)
      .innerJoin(
        conversation,
        and(
          eq(conversation.id, conversationParticipant.conversationId),
          isNull(conversation.deletedAt),
        ),
      )
      .where(eq(conversationParticipant.userId, userId));

    const convIds = userConvs.map((r) => r.conversationId);
    if (convIds.length === 0) return [];

    const partners = await db
      .selectDistinct({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(
        and(
          inArray(conversationParticipant.conversationId, convIds),
          ne(conversationParticipant.userId, userId),
        ),
      );

    return partners.map((r) => r.userId);
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

  // Import abuse guard for socket rate limiting
  const { guard: abuseGuard } = await import("./src/lib/abuse/guard");
  const { resolveIdentityFromRaw } = await import("./src/lib/abuse/identity");

  io.on("connection", async (socket) => {
    const userId = socket.data.user?.id as string;
    if (!userId) return;

    const socketIp =
      (socket.handshake.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      socket.handshake.address;
    const socketIdentity = resolveIdentityFromRaw({ userId, ip: socketIp });

    async function socketGuard(action: "socket.typing" | "socket.join"): Promise<boolean> {
      const result = await abuseGuard(action, socketIdentity);
      return result.decision === "allow" || result.decision === "degrade_to_review";
    }

    // Join personal notification room
    socket.join(`user:${userId}`);

    // Broadcast presence to conversation partners
    try {
      const partnerIds = await getConversationPartnerIds(userId);

      for (const partnerId of partnerIds) {
        io.to(`user:${partnerId}`).emit("user_online", { userId });
      }

      const onlinePartnerIds = partnerIds.filter((partnerId) => {
        const room = io.sockets.adapter.rooms.get(`user:${partnerId}`);
        return room && room.size > 0;
      });
      socket.emit("presence_sync", { onlineUserIds: onlinePartnerIds });
    } catch (err) {
      console.error("[socket] Presence error:", err);
    }

    // Join a conversation room
    socket.on("join_conversation", async (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !VALID_UUID.test(conversationId)) {
        return;
      }

      if (!(await socketGuard("socket.join"))) return;

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

      if (!(await socketGuard("socket.typing"))) return;

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

      if (!(await socketGuard("socket.typing"))) return;

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

    socket.on("disconnect", async () => {
      // Check if user still has other connected sockets
      const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
      if (!userRoom || userRoom.size === 0) {
        try {
          const partnerIds = await getConversationPartnerIds(userId);
          for (const partnerId of partnerIds) {
            io.to(`user:${partnerId}`).emit("user_offline", { userId });
          }
        } catch (err) {
          console.error("[socket] Presence disconnect error:", err);
        }
      }
    });
  });

  // Expire 48h match sessions periodically
  const { cmSession: cmSessionTable } = await import("./src/lib/schema");
  const MATCH_EXPIRY_CHECK_MS = 30_000;
  setInterval(async () => {
    try {
      const now = new Date();
      // Expire match sessions that have passed their expiresAt
      const expired = await db
        .select({ id: cmSessionTable.id })
        .from(cmSessionTable)
        .where(
          and(
            eq(cmSessionTable.type, "campus_match"),
            eq(cmSessionTable.status, "active"),
            lt(cmSessionTable.expiresAt, now),
          ),
        );

      for (const session of expired) {
        await db
          .update(cmSessionTable)
          .set({ status: "ended", endedAt: now, endedReason: "expired" })
          .where(eq(cmSessionTable.id, session.id));

        // Also expire the matchMatch record
        await db
          .update(matchMatch)
          .set({ status: "expired" })
          .where(
            and(
              eq(matchMatch.sessionId, session.id),
              eq(matchMatch.status, "active"),
            ),
          );

        // Notify participants
        const { cmSessionParticipant: cmSP } = await import("./src/lib/schema");
        const participants = await db
          .select({ userId: cmSP.userId })
          .from(cmSP)
          .where(eq(cmSP.sessionId, session.id));

        for (const p of participants) {
          io.to(`user:${p.userId}`).emit("match_session_expired", {
            sessionId: session.id,
          });
        }
      }

      if (expired.length > 0) {
        console.log(`[match-expiry] expired ${expired.length} match sessions`);
      }

      // Expire anon_chat sessions older than 48 hours
      const anonCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const expiredAnon = await db
        .select({ id: cmSessionTable.id })
        .from(cmSessionTable)
        .where(
          and(
            eq(cmSessionTable.type, "anon_chat"),
            eq(cmSessionTable.status, "active"),
            lt(cmSessionTable.createdAt, anonCutoff),
          ),
        );

      for (const session of expiredAnon) {
        await db
          .update(cmSessionTable)
          .set({ status: "ended", endedAt: now, endedReason: "expired" })
          .where(eq(cmSessionTable.id, session.id));

        const { cmSessionParticipant: cmSP } = await import("./src/lib/schema");
        const participants = await db
          .select({ userId: cmSP.userId })
          .from(cmSP)
          .where(eq(cmSP.sessionId, session.id));

        for (const p of participants) {
          io.to(`user:${p.userId}`).emit("campus_match_state_changed", {
            changedAt: now.toISOString(),
          });
        }
      }

      if (expiredAnon.length > 0) {
        console.log(`[match-expiry] expired ${expiredAnon.length} anon_chat sessions`);
      }
    } catch (error) {
      console.error("[match-expiry] worker failed", error);
    }
  }, MATCH_EXPIRY_CHECK_MS);

  // Periodic queue matcher — catches users who joined while no enqueue/skip triggered a pass
  const QUEUE_MATCH_INTERVAL_MS = 30_000;
  const { runImmediateQueuePass } = await import("./src/actions/campus-match");
  setInterval(async () => {
    try {
      await runImmediateQueuePass();
    } catch (error) {
      console.error("[queue-matcher] periodic pass failed", error);
    }
  }, QUEUE_MATCH_INTERVAL_MS);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
