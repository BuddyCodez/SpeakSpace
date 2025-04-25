import { z } from "zod"
import { publicProcedure, router, authedProcedure } from "../trpc"
import { inferRouterOutputs, TRPCError } from "@trpc/server"
import { prisma } from "../prisma"
import { observable } from "@trpc/server/observable"
import EventEmitter from "events"
import { AppRouter } from "./_app"

// Define message events
interface MessageEvents {
    newMessage: (data: MessageEvent) => void
    typingUpdate: () => void
}

declare interface MessageEventEmitter {
    on<T extends keyof MessageEvents>(event: T, listener: MessageEvents[T]): this
    emit<T extends keyof MessageEvents>(event: T, ...args: Parameters<MessageEvents[T]>): boolean
}

class MessageEventEmitter extends EventEmitter { }

const messageEventEmitter = new MessageEventEmitter()
export type RouterOutput = inferRouterOutputs<AppRouter>
export type MessageWithSender = RouterOutput["message"]["getSessionMessages"]["messages"][number]
// Define types for message events
type MessageEvent = {
    id: string
    content: string | null
    mediaUrl: string | null
    mediaType: string | null
    senderId: string
    sessionId: string
    createdAt: Date
    sender: {
        id: string
        username: string
        imageUrl: string | null
    }
}

// Track who is typing in which session
const currentlyTyping: Record<string, Record<string, { lastTyped: Date; username: string; id: string }>> = {}

// Clean up typing indicators every 3 seconds
const typingCleanupInterval = setInterval(() => {
    let updated = false
    const now = Date.now()

    Object.keys(currentlyTyping).forEach(sessionId => {
        Object.entries(currentlyTyping[sessionId]).forEach(([userId, data]) => {
            if (now - data.lastTyped.getTime() > 3000) {
                delete currentlyTyping[sessionId][userId]
                updated = true
            }
        })

        // Clean up empty session entries
        if (Object.keys(currentlyTyping[sessionId]).length === 0) {
            delete currentlyTyping[sessionId]
        }
    })

    if (updated) {
        messageEventEmitter.emit("typingUpdate")
    }
}, 3000)

// Clean up on server shutdown
process.on("SIGTERM", () => {
    clearInterval(typingCleanupInterval)
})

export const messageRouter = router({
    // Get messages for a session
    getSessionMessages: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            cursor: z.string().optional(),
            limit: z.number().min(1).max(100).default(50)
        }))
        .query(async ({ ctx, input }) => {
            const { sessionId, cursor, limit } = input

            // Verify that the user is a member of the session
            const membership = await prisma.sessionMember.findFirst({
                where: {
                    userId: ctx.user.id,
                    sessionId,
                    leftAt: null,
                    isBanned: false
                }
            })

            if (!membership) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not a member of this session"
                })
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
            })

            let nextCursor: string | undefined = undefined
            if (messages.length > limit) {
                const nextItem = messages.pop()
                nextCursor = nextItem?.id
            }

            // Return messages in reverse order to show oldest first
            return {
                messages: messages.reverse(),
                nextCursor
            }
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
            mediaType: z.string().optional(),
            isSystemMessage: z.boolean().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const { sessionId, content, mediaFile, mediaType, isSystemMessage} = input
            const userId = ctx.user.id
            if (isSystemMessage) {
                const systemMessage = await prisma.message.create({
                    data: {
                        content,
                        mediaUrl: null,
                        mediaType: 'system',
                        senderId: userId,
                        sessionId,
                       
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
                })
                messageEventEmitter.emit("newMessage", systemMessage)
            }
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
            })

            if (!membership) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not allowed to send messages in this session"
                })
            }

            // Validate that at least one of content or mediaFile is provided
            if (!content && !mediaFile) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Message must contain text or media"
                })
            }

            // Handle file upload if provided
            let mediaUrl = null
            if (mediaFile) {
                // In a real implementation, you would upload to a storage service
                // and get back a URL. For now, we'll simulate that.
                mediaUrl = `https://storage.example.com/${Date.now()}-${mediaFile.name}`
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
            })

            // Remove typing indicator when sending a message
            if (currentlyTyping[sessionId]?.[userId]) {
                delete currentlyTyping[sessionId][userId]
                messageEventEmitter.emit("typingUpdate")
            }

            // Emit a new message event for real-time updates
            messageEventEmitter.emit("newMessage", message)

            return message
        }),

    // Update typing status
    isTyping: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            typing: z.boolean()
        }))
        .mutation(({ ctx, input }) => {
            const { sessionId, typing } = input
            const userId = ctx.user.id
            const username = ctx.user.name || "Anonymous"

            // Initialize session if it doesn't exist
            if (!currentlyTyping[sessionId]) {
                currentlyTyping[sessionId] = {}
            }

            if (!typing) {
                // Remove typing indicator
                if (currentlyTyping[sessionId]?.[userId]) {
                    delete currentlyTyping[sessionId][userId]

                    // Clean up empty session
                    if (Object.keys(currentlyTyping[sessionId]).length === 0) {
                        delete currentlyTyping[sessionId]
                    }
                }
            } else {
                // Add or update typing indicator
                currentlyTyping[sessionId][userId] = {
                    lastTyped: new Date(),
                    username,
                    id: userId
                }
            }

            // Emit typing update event
            messageEventEmitter.emit("typingUpdate")

            return { success: true }
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
                        emit.next(data)
                    }
                }

                messageEventEmitter.on("newMessage", onNewMessage)
                return () => {
                    messageEventEmitter.off("newMessage", onNewMessage)
                }
            })
        }),

    // Subscribe to typing indicators
    whoIsTyping: publicProcedure
        .input(z.object({
            sessionId: z.string()
        }))
        .subscription(({ input }) => {
            return observable<Array<{ id: string; username: string }>>((emit) => {
                const onTypingUpdate = () => {
                    const typingUsers = Object.values(currentlyTyping[input.sessionId] || {}).map(user => ({
                        id: user.id,
                        username: user.username
                    }))

                    emit.next(typingUsers)
                }

                // Send initial state
                onTypingUpdate()

                messageEventEmitter.on("typingUpdate", onTypingUpdate)
                return () => {
                    messageEventEmitter.off("typingUpdate", onTypingUpdate)
                }
            })
        })
})
