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
import { eq, and, desc, lt, sql, ne, count } from "drizzle-orm";
import { getSession, type ActionResult } from "./_helpers";
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

  if (userId === targetUserId) {
    return { success: false, error: "Cannot message yourself" };
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

  // Get all conversations for user
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

  const conversations: ConversationPreview[] = [];

  for (const participation of myParticipations) {
    const convId = participation.conversationId;

    // Get conversation data
    const [conv] = await db
      .select({
        id: conversation.id,
        isRequest: conversation.isRequest,
        updatedAt: conversation.updatedAt,
      })
      .from(conversation)
      .where(eq(conversation.id, convId));

    if (!conv) continue;

    // Get other participant
    const [otherParticipant] = await db
      .select({
        userId: conversationParticipant.userId,
      })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, convId),
          ne(conversationParticipant.userId, userId),
        ),
      )
      .limit(1);

    if (!otherParticipant) continue;

    // Get other user's info
    const [otherUser] = await db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, otherParticipant.userId));

    if (!otherUser) continue;

    // Get last message
    const [lastMsg] = await db
      .select({
        body: message.body,
        imageUrl: message.imageUrl,
        senderId: message.senderId,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(eq(message.conversationId, convId))
      .orderBy(desc(message.createdAt))
      .limit(1);

    // Count unread messages
    let unreadCount = 0;
    if (participation.lastReadAt) {
      const [unread] = await db
        .select({ count: count() })
        .from(message)
        .where(
          and(
            eq(message.conversationId, convId),
            sql`${message.createdAt} > ${participation.lastReadAt}`,
            ne(message.senderId, userId),
          ),
        );
      unreadCount = unread?.count ?? 0;
    } else if (lastMsg) {
      // Never read — count all messages from others
      const [unread] = await db
        .select({ count: count() })
        .from(message)
        .where(
          and(
            eq(message.conversationId, convId),
            ne(message.senderId, userId),
          ),
        );
      unreadCount = unread?.count ?? 0;
    }

    // Get request info if applicable
    let requestStatus: string | undefined;
    let requestFromUserId: string | undefined;
    let requestToUserId: string | undefined;

    if (conv.isRequest) {
      const [req] = await db
        .select({
          status: messageRequest.status,
          fromUserId: messageRequest.fromUserId,
          toUserId: messageRequest.toUserId,
        })
        .from(messageRequest)
        .where(eq(messageRequest.conversationId, convId))
        .limit(1);

      if (req) {
        requestStatus = req.status;
        requestFromUserId = req.fromUserId;
        requestToUserId = req.toUserId;
      }
    }

    conversations.push({
      id: conv.id,
      isRequest: conv.isRequest,
      updatedAt: conv.updatedAt.toISOString(),
      otherUser,
      lastMessage: lastMsg
        ? {
            body: lastMsg.body,
            imageUrl: lastMsg.imageUrl,
            senderId: lastMsg.senderId,
            createdAt: lastMsg.createdAt.toISOString(),
          }
        : null,
      unreadCount,
      requestStatus,
      requestFromUserId,
      requestToUserId,
    });
  }

  // Sort by updatedAt descending
  conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

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

  // Get all non-request conversations for user
  const participations = await db
    .select({
      conversationId: conversationParticipant.conversationId,
      lastReadAt: conversationParticipant.lastReadAt,
    })
    .from(conversationParticipant)
    .innerJoin(
      conversation,
      eq(conversation.id, conversationParticipant.conversationId),
    )
    .where(
      and(
        eq(conversationParticipant.userId, userId),
        eq(conversation.isRequest, false),
      ),
    );

  let totalUnread = 0;

  for (const p of participations) {
    const conditions = [
      eq(message.conversationId, p.conversationId),
      ne(message.senderId, userId),
    ];

    if (p.lastReadAt) {
      conditions.push(sql`${message.createdAt} > ${p.lastReadAt}`);
    }

    const [result] = await db
      .select({ count: count() })
      .from(message)
      .where(and(...conditions));

    if (result && result.count > 0) {
      totalUnread++;
    }
  }

  return { success: true, data: totalUnread };
}
