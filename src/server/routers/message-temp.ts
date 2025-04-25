// src/server/api/routers/messageRouter.ts
import { z } from "zod";
import { publicProcedure, router, authedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "../prisma";
import { observable } from "@trpc/server/observable";
import EventEmitter from "events";

// Define message events
interface MessageEvents {
    newMessage: (data: MessageEvent) => void;
}

declare interface MessageEventEmitter {
    on<T extends keyof MessageEvents>(event: T, listener: MessageEvents[T]): this;
    emit<T extends keyof MessageEvents>(event: T, ...args: Parameters<MessageEvents[T]>): boolean;
}

class MessageEventEmitter extends EventEmitter { }

const messageEventEmitter = new MessageEventEmitter();

// Define types for message events
type MessageEvent = {
    id: string;
    content: string | null;
    mediaUrl: string | null;
    mediaType: string | null;
    senderId: string;
    sessionId: string;
    createdAt: Date;
    sender: {
        id: string;
        username: string;
        imageUrl: string | null;
    };
};

export const messageRouter = router({
    // Get messages for a session
    getSessionMessages: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            cursor: z.string().optional(),
            limit: z.number().min(1).max(100).default(50)
        }))
        .query(async ({ ctx, input }) => {
            const { sessionId, cursor, limit } = input;

            // Verify that the user is a member of the session
            const membership = await prisma.sessionMember.findFirst({
                where: {
                    userId: ctx.user.id,
                    sessionId,
                    leftAt: null,
                    isBanned: false
                }
            });

            if (!membership) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not a member of this session"
                });
            }

            // Get messages with pagination
            const messages = await prisma.message.findMany({
                where: { sessionId },
                orderBy: { createdAt: "desc" },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                include: {
                    sender: {
                        select: {
                            id: true,
                            username: true,
                            imageUrl: true
                        }
                    }
                }
            });

            let nextCursor: string | undefined = undefined;
            if (messages.length > limit) {
                const nextItem = messages.pop();
                nextCursor = nextItem?.id;
            }

            // Return messages in reverse order to show oldest first
            return {
                messages: messages.reverse(),
                nextCursor
            };
        }),

    // Send a message
    send: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            content: z.string().optional(),
            mediaFile: z.object({
                name: z.string(),
                type: z.string(),
                size: z.number(),
                data: z.string() // Base64 encoded file data
            }).optional(),
            mediaType: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const { sessionId, content, mediaFile, mediaType } = input;
            const userId = ctx.user.id;

            // Verify that the user is a member of the session
            const membership = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId,
                    leftAt: null,
                    isBanned: false,
                    isMuted: false // Can't send messages if muted
                },
                include: {
                    user: true
                }
            });

            if (!membership) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not allowed to send messages in this session"
                });
            }

            // Validate that at least one of content or mediaFile is provided
            if (!content && !mediaFile) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Message must contain text or media"
                });
            }

            // Handle file upload if provided
            let mediaUrl = null;
            if (mediaFile) {
                // In a real implementation, you would upload to a storage service
                // and get back a URL. For now, we'll simulate that.
                mediaUrl = `https://storage.example.com/${Date.now()}-${mediaFile.name}`;
            }

            // Create the message
            const message = await prisma.message.create({
                data: {
                    content,
                    mediaUrl,
                    mediaType,
                    senderId: userId,
                    sessionId
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            username: true,
                            imageUrl: true
                        }
                    }
                }
            });

            // Emit a new message event for real-time updates
            messageEventEmitter.emit("newMessage", message);

            return message;
        }),

    // Delete a message (only own messages or moderator)
    delete: authedProcedure
        .input(z.object({
            messageId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Get the message with session info
            const message = await prisma.message.findUnique({
                where: { id: input.messageId },
                include: {
                    session: {
                        include: {
                            sessionMembers: {
                                where: {
                                    userId,
                                    role: { in: ["MODERATOR", "EVALUATOR"] },
                                    leftAt: null
                                }
                            }
                        }
                    }
                }
            });

            if (!message) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Message not found"
                });
            }

            // Check if user is the sender or a moderator
            const isSender = message.senderId === userId;
            const isModerator = message.session.sessionMembers.length > 0;

            if (!isSender && !isModerator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not allowed to delete this message"
                });
            }

            // Delete the message
            await prisma.message.delete({
                where: { id: input.messageId }
            });

            return { success: true };
        }),

    // Subscribe to new messages
    onNewMessage: publicProcedure
        .input(z.object({
            sessionId: z.string()
        }))
        .subscription(({ input }) => {
            return observable<MessageEvent>((emit) => {
                const onNewMessage = (data: MessageEvent) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                messageEventEmitter.on("newMessage", onNewMessage);
                return () => {
                    messageEventEmitter.off("newMessage", onNewMessage);
                };
            });
        })
});