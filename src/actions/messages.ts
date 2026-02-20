"use server";

import { db } from "@/lib/db";
import {
  conversation,
  conversationParticipant,
  message,
  messageRequest,
  userFollow,
  userPrivacySetting,
} from "@/lib/schema";
import { user } from "@/lib/auth-schema";
import { eq, and, desc, lt, sql, ne } from "drizzle-orm";
import { getSession, guardAction, type ActionResult } from "./_helpers";
import { getIO } from "@/lib/socket-server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConversationPreview = {
  id: string;
  isRequest: boolean;
  updatedAt: string;
  otherUser: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  lastMessage: {
    body: string | null;
    imageUrl: string | null;
    senderId: string | null;
    createdAt: string;
  } | null;
  unreadCount: number;
  requestStatus?: string;
  requestFromUserId?: string;
  requestToUserId?: string;
};

export type MessageData = {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  } | null;
};

const VALID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return VALID_UUID.test(value);
}

// ─── getOrCreateConversation ─────────────────────────────────────────────────

export async function getOrCreateConversation(
  targetUserId: string,
): Promise<ActionResult<{ conversationId: string; isRequest: boolean }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  const convLimited = await guardAction("conversation.create", { userId });
  if (convLimited) return convLimited;

  if (userId === targetUserId) {
    return { success: false, error: "Cannot message yourself" };
  }

  const targetUser = await db.query.user.findFirst({
    where: eq(user.id, targetUserId),
    columns: { id: true },
  });
  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

  const pairKey = [userId, targetUserId].sort().join(":");

  const result = await db.transaction(async (tx) => {
    // Serialize 1:1 conversation creation per user pair.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${pairKey}))`);

    const myConversations = tx
      .select({ conversationId: conversationParticipant.conversationId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.userId, userId));

    const existing = await tx
      .select({
        conversationId: conversationParticipant.conversationId,
        isRequest: conversation.isRequest,
      })
      .from(conversationParticipant)
      .innerJoin(
        conversation,
        eq(conversation.id, conversationParticipant.conversationId),
      )
      .where(
        and(
          eq(conversationParticipant.userId, targetUserId),
          sql`${conversationParticipant.conversationId} IN (${myConversations})`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        conversationId: existing[0].conversationId,
        isRequest: existing[0].isRequest,
      };
    }

    // Privacy setting applies only when opening a brand-new conversation.
    const [targetPrivacy] = await tx
      .select({ allowMessagesFrom: userPrivacySetting.allowMessagesFrom })
      .from(userPrivacySetting)
      .where(eq(userPrivacySetting.userId, targetUserId))
      .limit(1);

    if (targetPrivacy?.allowMessagesFrom === "nobody") {
      return { error: "This user is not accepting new messages" };
    }

    const [iFollow, theyFollow] = await Promise.all([
      tx
        .select({ id: userFollow.id })
        .from(userFollow)
        .where(
          and(
            eq(userFollow.followerId, userId),
            eq(userFollow.followingId, targetUserId),
          ),
        )
        .limit(1),
      tx
        .select({ id: userFollow.id })
        .from(userFollow)
        .where(
          and(
            eq(userFollow.followerId, targetUserId),
            eq(userFollow.followingId, userId),
          ),
        )
        .limit(1),
    ]);

    const isMutual = iFollow.length > 0 && theyFollow.length > 0;
    const isRequest = !isMutual;

    const [newConv] = await tx
      .insert(conversation)
      .values({ isRequest })
      .returning({ id: conversation.id });

    await tx.insert(conversationParticipant).values([
      { conversationId: newConv.id, userId },
      { conversationId: newConv.id, userId: targetUserId },
    ]);

    if (isRequest) {
      await tx.insert(messageRequest).values({
        conversationId: newConv.id,
        fromUserId: userId,
        toUserId: targetUserId,
      });
    }

    return { conversationId: newConv.id, isRequest };
  });

  if ("error" in result) {
    return {
      success: false,
      error: result.error ?? "Unable to create conversation",
    };
  }

  return { success: true, data: result };
}

// ─── sendMessage ─────────────────────────────────────────────────────────────

export async function sendMessage(input: {
  conversationId: string;
  body?: string;
  imageUrl?: string;
}): Promise<ActionResult<MessageData>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  const limited = await guardAction("message.send", { userId });
  if (limited) return limited;

  if (!isValidUuid(input.conversationId)) {
    return { success: false, error: "Invalid conversation ID" };
  }

  if (!input.body?.trim() && !input.imageUrl) {
    return { success: false, error: "Message cannot be empty" };
  }

  const persisted = await db.transaction(async (tx) => {
    const participant = await tx
      .select({ id: conversationParticipant.id })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, input.conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .limit(1);

    if (participant.length === 0) {
      return { error: "Not a participant" };
    }

    // Serialize request checks + first message creation within this conversation.
    await tx.execute(
      sql`SELECT id FROM "conversation" WHERE id = ${input.conversationId} FOR UPDATE`,
    );

    const conv = await tx
      .select({ isRequest: conversation.isRequest })
      .from(conversation)
      .where(eq(conversation.id, input.conversationId))
      .limit(1);

    if (conv.length === 0) {
      return { error: "Conversation not found" };
    }

    let requestToUserId: string | null = null;
    if (conv[0].isRequest) {
      const request = await tx
        .select({
          fromUserId: messageRequest.fromUserId,
          toUserId: messageRequest.toUserId,
          status: messageRequest.status,
        })
        .from(messageRequest)
        .where(eq(messageRequest.conversationId, input.conversationId))
        .limit(1);

      if (request.length === 0) {
        return { error: "Request not found" };
      }

      if (request[0].status === "declined") {
        return { error: "This request was declined" };
      }

      if (request[0].fromUserId !== userId) {
        return {
          error: "Only the requester can send messages until the request is accepted",
        };
      }

      const existingMessages = await tx
        .select({ id: message.id })
        .from(message)
        .where(eq(message.conversationId, input.conversationId))
        .limit(1);

      if (existingMessages.length > 0) {
        return {
          error: "You can only send one message until your request is accepted",
        };
      }

      requestToUserId = request[0].toUserId;
    }

    const [newMessage] = await tx
      .insert(message)
      .values({
        conversationId: input.conversationId,
        senderId: userId,
        body: input.body?.trim() || null,
        imageUrl: input.imageUrl || null,
      })
      .returning();

    await tx
      .update(conversation)
      .set({ updatedAt: new Date() })
      .where(eq(conversation.id, input.conversationId));

    const senderUser = await tx
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const participants = await tx
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.conversationId, input.conversationId));

    const messageData: MessageData = {
      id: newMessage.id,
      conversationId: newMessage.conversationId,
      senderId: newMessage.senderId,
      body: newMessage.body,
      imageUrl: newMessage.imageUrl,
      createdAt: newMessage.createdAt.toISOString(),
      sender: senderUser[0] || null,
    };

    return {
      messageData,
      isRequest: conv[0].isRequest,
      requestToUserId,
      participantUserIds: participants.map((p) => p.userId),
    };
  });

  if ("error" in persisted) {
    return {
      success: false,
      error: persisted.error ?? "Unable to send message",
    };
  }

  // Emit real-time events
  try {
    const io = getIO();
    if (io) {
      io.to(`conv:${input.conversationId}`).emit("new_message", persisted.messageData);

      // If this is a request, notify the recipient
      if (persisted.isRequest && persisted.requestToUserId) {
        io.to(`user:${persisted.requestToUserId}`).emit("new_request", {
          conversationId: input.conversationId,
        });
      }

      // Notify all participants for conversation list refresh
      for (const participantUserId of persisted.participantUserIds) {
        if (participantUserId !== userId) {
          io.to(`user:${participantUserId}`).emit("conversation_updated", {
            conversationId: input.conversationId,
          });
        }
      }
    }
  } catch {
    // Socket.io not available (e.g., during SSR), messages still saved to DB
  }

  return { success: true, data: persisted.messageData };
}

// ─── getConversations ────────────────────────────────────────────────────────

export async function getConversations(): Promise<
  ActionResult<{ messages: ConversationPreview[]; requests: ConversationPreview[] }>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  // 1. Get my participations
  const myParticipations = await db
    .select({
      conversationId: conversationParticipant.conversationId,
      lastReadAt: conversationParticipant.lastReadAt,
    })
    .from(conversationParticipant)
    .where(eq(conversationParticipant.userId, userId));

  if (myParticipations.length === 0) {
    return { success: true, data: { messages: [], requests: [] } };
  }

  const convIds = myParticipations.map((p) => p.conversationId);
  const convIdsSql = sql.join(convIds.map((id) => sql`${id}`), sql`, `);

  // 2. Get conversation data + other participant info (single query with JOINs)
  const convRows = await db
    .select({
      convId: conversation.id,
      isRequest: conversation.isRequest,
      updatedAt: conversation.updatedAt,
      otherUserId: user.id,
      otherUserName: user.name,
      otherUserUsername: user.username,
      otherUserImage: user.image,
    })
    .from(conversation)
    .innerJoin(
      conversationParticipant,
      and(
        eq(conversationParticipant.conversationId, conversation.id),
        ne(conversationParticipant.userId, userId),
      ),
    )
    .innerJoin(user, eq(user.id, conversationParticipant.userId))
    .where(sql`${conversation.id} IN (${convIdsSql})`)
    .orderBy(desc(conversation.updatedAt));

  if (convRows.length === 0) {
    return { success: true, data: { messages: [], requests: [] } };
  }

  // 3. Get last message per conversation using DISTINCT ON (single query)
  const lastMsgResult = await db.execute<{
    conversation_id: string;
    body: string | null;
    image_url: string | null;
    sender_id: string | null;
    created_at: string;
  }>(sql`
    SELECT DISTINCT ON (conversation_id)
      conversation_id, body, image_url, sender_id, created_at
    FROM message
    WHERE conversation_id IN (${convIdsSql})
    ORDER BY conversation_id, created_at DESC
  `);

  const lastMsgMap = new Map(
    lastMsgResult.rows.map((r) => [r.conversation_id, r]),
  );

  // 4. Get unread counts per conversation (single query)
  const unreadResult = await db.execute<{
    conversation_id: string;
    unread_count: string;
  }>(sql`
    SELECT m.conversation_id, COUNT(*)::text AS unread_count
    FROM message m
    JOIN conversation_participant cp
      ON cp.conversation_id = m.conversation_id
      AND cp.user_id = ${userId}
    WHERE m.conversation_id IN (${convIdsSql})
      AND m.sender_id != ${userId}
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
    GROUP BY m.conversation_id
  `);

  const unreadMap = new Map(
    unreadResult.rows.map((r) => [r.conversation_id, Number(r.unread_count)]),
  );

  // 5. Get request info for request conversations (single query)
  const requestConvIds = convRows
    .filter((r) => r.isRequest)
    .map((r) => r.convId);
  const requestMap = new Map<
    string,
    { status: string; fromUserId: string; toUserId: string }
  >();

  if (requestConvIds.length > 0) {
    const requestIdsSql = sql.join(
      requestConvIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const requestRows = await db
      .select({
        conversationId: messageRequest.conversationId,
        status: messageRequest.status,
        fromUserId: messageRequest.fromUserId,
        toUserId: messageRequest.toUserId,
      })
      .from(messageRequest)
      .where(
        sql`${messageRequest.conversationId} IN (${requestIdsSql})`,
      );
    for (const r of requestRows) {
      requestMap.set(r.conversationId, r);
    }
  }

  // 6. Assemble results
  const conversations: ConversationPreview[] = convRows.map((row) => {
    const lastMsg = lastMsgMap.get(row.convId);
    const request = requestMap.get(row.convId);

    return {
      id: row.convId,
      isRequest: row.isRequest,
      updatedAt: row.updatedAt.toISOString(),
      otherUser: {
        id: row.otherUserId,
        name: row.otherUserName,
        username: row.otherUserUsername,
        image: row.otherUserImage,
      },
      lastMessage: lastMsg
        ? {
            body: lastMsg.body,
            imageUrl: lastMsg.image_url,
            senderId: lastMsg.sender_id,
            createdAt:
              typeof lastMsg.created_at === "string"
                ? new Date(lastMsg.created_at).toISOString()
                : lastMsg.created_at,
          }
        : null,
      unreadCount: unreadMap.get(row.convId) ?? 0,
      requestStatus: request?.status,
      requestFromUserId: request?.fromUserId,
      requestToUserId: request?.toUserId,
    };
  });

  return {
    success: true,
    data: {
      messages: conversations.filter((c) => !c.isRequest),
      requests: conversations.filter((c) => c.isRequest),
    },
  };
}

// ─── getMessages ─────────────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string,
  cursor?: string,
): Promise<ActionResult<{ messages: MessageData[]; nextCursor: string | null }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  if (!isValidUuid(conversationId)) {
    return { success: false, error: "Invalid conversation ID" };
  }

  // Verify participant
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

  if (participant.length === 0) {
    return { success: false, error: "Not a participant" };
  }

  const PAGE_SIZE = 50;

  const conditions = [eq(message.conversationId, conversationId)];
  if (cursor) {
    conditions.push(lt(message.createdAt, new Date(cursor)));
  }

  const messages = await db
    .select({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      imageUrl: message.imageUrl,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(and(...conditions))
    .orderBy(desc(message.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = messages.length > PAGE_SIZE;
  const pageMessages = hasMore ? messages.slice(0, PAGE_SIZE) : messages;

  // Get sender info for all messages
  const senderIds = [...new Set(pageMessages.map((m) => m.senderId).filter(Boolean))] as string[];
  const senders =
    senderIds.length > 0
      ? await db
          .select({
            id: user.id,
            name: user.name,
            username: user.username,
            image: user.image,
          })
          .from(user)
          .where(sql`${user.id} IN (${sql.join(senderIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

  const senderMap = new Map(senders.map((s) => [s.id, s]));

  const result: MessageData[] = pageMessages
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      imageUrl: m.imageUrl,
      createdAt: m.createdAt.toISOString(),
      sender: m.senderId ? senderMap.get(m.senderId) ?? null : null,
    }))
    .reverse(); // Return oldest first

  return {
    success: true,
    data: {
      messages: result,
      nextCursor: hasMore
        ? pageMessages[pageMessages.length - 1].createdAt.toISOString()
        : null,
    },
  };
}

// ─── acceptRequest ───────────────────────────────────────────────────────────

export async function acceptRequest(
  conversationId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  if (!isValidUuid(conversationId)) {
    return { success: false, error: "Invalid conversation ID" };
  }

  const [request] = await db
    .select()
    .from(messageRequest)
    .where(eq(messageRequest.conversationId, conversationId))
    .limit(1);

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.toUserId !== userId) {
    return { success: false, error: "Only the recipient can accept requests" };
  }

  if (request.status !== "pending") {
    return { success: false, error: "Request already handled" };
  }

  await db
    .update(messageRequest)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(messageRequest.id, request.id));

  await db
    .update(conversation)
    .set({ isRequest: false, updatedAt: new Date() })
    .where(eq(conversation.id, conversationId));

  // Emit real-time event
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${request.fromUserId}`).emit("request_accepted", {
        conversationId,
      });
      io.to(`conv:${conversationId}`).emit("request_accepted", {
        conversationId,
      });
    }
  } catch {
    // Socket.io not available
  }

  return { success: true, data: undefined };
}

// ─── declineRequest ──────────────────────────────────────────────────────────

export async function declineRequest(
  conversationId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  if (!isValidUuid(conversationId)) {
    return { success: false, error: "Invalid conversation ID" };
  }

  const [request] = await db
    .select()
    .from(messageRequest)
    .where(eq(messageRequest.conversationId, conversationId))
    .limit(1);

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.toUserId !== userId) {
    return { success: false, error: "Only the recipient can decline requests" };
  }

  if (request.status !== "pending") {
    return { success: false, error: "Request already handled" };
  }

  await db
    .update(messageRequest)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(messageRequest.id, request.id));

  // Emit real-time event
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${request.fromUserId}`).emit("request_declined", {
        conversationId,
      });
      io.to(`user:${request.toUserId}`).emit("request_declined", {
        conversationId,
      });
      io.to(`conv:${conversationId}`).emit("request_declined", {
        conversationId,
      });
    }
  } catch {
    // Socket.io not available
  }

  return { success: true, data: undefined };
}

// ─── markAsRead ──────────────────────────────────────────────────────────────

export async function markAsRead(
  conversationId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  if (!isValidUuid(conversationId)) {
    return { success: false, error: "Invalid conversation ID" };
  }

  const updated = await db
    .update(conversationParticipant)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipant.conversationId, conversationId),
        eq(conversationParticipant.userId, userId),
      ),
    )
    .returning({ id: conversationParticipant.id });

  if (updated.length === 0) {
    return { success: false, error: "Not a participant" };
  }

  // Emit read receipt
  try {
    const io = getIO();
    if (io) {
      io.to(`conv:${conversationId}`).emit("message_read", {
        conversationId,
        userId,
        readAt: new Date().toISOString(),
      });
    }
  } catch {
    // Socket.io not available
  }

  return { success: true, data: undefined };
}

// ─── getUnreadCount ──────────────────────────────────────────────────────────

export async function getUnreadCount(): Promise<ActionResult<number>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const userId = session.user.id;

  // Count conversations with unread messages (single query)
  const result = await db.execute<{ count: string }>(sql`
    SELECT COUNT(DISTINCT m.conversation_id)::text AS count
    FROM message m
    JOIN conversation_participant cp
      ON cp.conversation_id = m.conversation_id
      AND cp.user_id = ${userId}
    JOIN conversation c
      ON c.id = m.conversation_id
      AND c.is_request = false
    WHERE m.sender_id != ${userId}
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
  `);

  return { success: true, data: Number(result.rows[0]?.count ?? 0) };
}
