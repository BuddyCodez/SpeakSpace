// src/server/api/routers/sessionRouter.ts
import { z } from "zod";
import { publicProcedure, router, authedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { CommunicationMode, SessionType, UserRole, ModerationActionType } from "@prisma/client";
import { prisma } from "../prisma";
import { nanoid } from "nanoid";
import { observable } from "@trpc/server/observable";
import EventEmitter from "events";

// Enhanced strongly-typed event emitter
interface SessionEvents {
    userJoined: (data: SessionEvent) => void;
    userLeft: (data: SessionEvent) => void;
    userBanned: (data: ModerationEvent) => void;
    userKicked: (data: ModerationEvent) => void;
    userMuted: (data: ModerationEvent) => void;
    userWarned: (data: ModerationEvent) => void;
    sessionEnded: (data: { sessionId: string }) => void;
    sessionUpdated: (data: { sessionId: string }) => void;
    roleChanged: (data: RoleChangeEvent) => void;
}

declare interface SessionEventEmitter {
    on<T extends keyof SessionEvents>(event: T, listener: SessionEvents[T]): this;
    emit<T extends keyof SessionEvents>(event: T, ...args: Parameters<SessionEvents[T]>): boolean;
}

class SessionEventEmitter extends EventEmitter { }

const sessionEventEmitter = new SessionEventEmitter();

// Types for real-time events
type SessionEvent = {
    sessionId: string;
    user: {
        id: string;
        username: string;
        email: string;
        imageUrl: string | null;
        role: UserRole;
    };
};

type ModerationEvent = SessionEvent & {
    action: ModerationActionType;
    reason?: string;
    durationMinutes?: number;
    moderator: {
        id: string;
        username: string;
    };
};

type RoleChangeEvent = {
    sessionId: string;
    userId: string;
    oldRole: UserRole;
    newRole: UserRole;
    changedBy: {
        id: string;
        username: string;
    };
};

export const sessionRouter = router({
    // Get session by join code
    getByCode: authedProcedure
        .input(z.object({ code: z.string() }))
        .query(async ({ input }) => {
            const session = await prisma.session.findUnique({
                where: { code: input.code },
                include: {
                    creator: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            imageUrl: true
                        },
                    },
                    sessionMembers: {
                        where: { leftAt: null, isBanned: false },
                        include: {
                            user: true
                        }
                    },
                    messages: {
                        take: 50,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    username: true,
                                    imageUrl: true
                                }
                            }
                        }
                    }
                },
            });

            if (!session) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Session not found",
                });
            }

            return session;
        }),

    // Create a new session
    create: authedProcedure
        .input(
            z.object({
                title: z.string().min(3).max(100),
                description: z.string().optional(),
                sessionType: z.nativeEnum(SessionType),
                communicationModes: z.array(z.nativeEnum(CommunicationMode)).min(1),
                maxParticipants: z.number().min(2).max(100).optional(),
                isPrivate: z.boolean().optional().default(false),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Generate a unique room code
            const code = nanoid(10);

            // Create the session
            const session = await prisma.session.create({
                data: {
                    code,
                    title: input.title,
                    description: input.description,
                    sessionType: input.sessionType,
                    communicationModes: input.communicationModes,
                    creatorId: userId,
                    // isPrivate: input.isPrivate,
                },
            });

            // Add the creator as a MODERATOR
            await prisma.sessionMember.create({
                data: {
                    userId,
                    sessionId: session.id,
                    role: UserRole.MODERATOR,
                },
            });

            return {
                session,
                joinLink: `${process.env.NEXT_PUBLIC_APP_URL}/sessions/join/${code}`
            };
        }),

    // Join a session
    join: authedProcedure
        .input(z.object({
            code: z.string(),
            role: z.nativeEnum(UserRole).optional(),
            rejoin: z.boolean().optional().default(false),
            password: z.string().optional() // For private sessions
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Find the session with active members
            const session = await prisma.session.findUnique({
                where: { code: input.code },
                include: {
                    sessionMembers: {
                        where: { leftAt: null },
                        include: { user: true }
                    },
                    creator: true
                },
            });

            if (!session) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Session not found",
                });
            }

            // Check if session is private and requires password
            // if ( !input.password) {
            //     throw new TRPCError({
            //         code: "FORBIDDEN",
            //         message: "This session is private and requires a password",
            //     });
            // }

            // Check if user is already a member
            const existingMember = session.sessionMembers.find(
                (member) => member.userId === userId
            );

            if (existingMember) {
                if (existingMember.isBanned) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "You have been banned from this session",
                    });
                }

                if (existingMember.leftAt) {
                    const updatedMember = await prisma.sessionMember.update({
                        where: { id: existingMember.id },
                        data: { leftAt: null },
                        include: { user: true }
                    });

                    // Emit user rejoined event
                    sessionEventEmitter.emit('userJoined', {
                        sessionId: session.id,
                        user: {
                            id: updatedMember.user.id,
                            username: updatedMember.user.username,
                            email: updatedMember.user.email,
                            imageUrl: updatedMember.user.imageUrl,
                            role: updatedMember.role
                        }
                    });

                    return { session, isRejoin: true };
                }

                return { session, isRejoin: false };
            }

            // Create new session member
            const newMember = await prisma.sessionMember.create({
                data: {
                    userId,
                    sessionId: session.id,
                    role: input.role || UserRole.PARTICIPANT,
                },
                include: {
                    user: true
                }
            });

            // Emit user joined event
            sessionEventEmitter.emit('userJoined', {
                sessionId: session.id,
                user: {
                    id: newMember.user.id,
                    username: newMember.user.username,
                    email: newMember.user.email,
                    imageUrl: newMember.user.imageUrl,
                    role: newMember.role
                }
            });

            return { session, isRejoin: false };
        }),

    // Leave a session
    leave: authedProcedure
        .input(z.object({ sessionId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            const member = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    leftAt: null
                },
                include: {
                    user: true,
                    session: true
                }
            });

            if (!member) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "You are not an active member of this session",
                });
            }

            // Update the leftAt timestamp
            await prisma.sessionMember.update({
                where: { id: member.id },
                data: { leftAt: new Date() },
            });

            // Emit member left event
            sessionEventEmitter.emit('userLeft', {
                sessionId: input.sessionId,
                user: {
                    id: member.user.id,
                    username: member.user.username,
                    email: member.user.email,
                    imageUrl: member.user.imageUrl,
                    role: member.role
                }
            });

            // If creator leaves, end the session
            if (member.session.creatorId === userId) {
                await prisma.session.update({
                    where: { id: input.sessionId },
                    data: { isActive: false }
                });
                sessionEventEmitter.emit('sessionEnded', { sessionId: input.sessionId });
            }

            return { success: true };
        }),

    // Ban user (Moderator only)
    banUser: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            targetUserId: z.string(),
            reason: z.string().optional(),
            durationMinutes: z.number().optional() // Temporary ban duration
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify moderator status
            const moderator = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    role: { in: [UserRole.MODERATOR, UserRole.EVALUATOR] },
                    leftAt: null
                },
                include: {
                    user: true
                }
            });

            if (!moderator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only moderators can ban users",
                });
            }

            // Get target user info
            const targetMember = await prisma.sessionMember.findFirst({
                where: {
                    userId: input.targetUserId,
                    sessionId: input.sessionId,
                    leftAt: null
                },
                include: {
                    user: true
                }
            });

            if (!targetMember) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found in this session",
                });
            }

            // Can't ban other moderators unless you're the creator
            if (targetMember.role === UserRole.MODERATOR &&
                moderator.role !== UserRole.MODERATOR) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only session creator can ban other moderators",
                });
            }

            // Ban the target user
            await prisma.$transaction([
                prisma.sessionMember.update({
                    where: { id: targetMember.id },
                    data: {
                        isBanned: true,
                        leftAt: new Date(),
                    },
                }),
                prisma.moderationAction.create({
                    data: {
                        actionType: ModerationActionType.BAN,
                        reason: input.reason,
                        durationMinutes: input.durationMinutes,
                        userId: targetMember.userId,
                        moderatorId: userId,
                        sessionId: input.sessionId,
                        sessionMemberId: targetMember.id,
                        expiresAt: input.durationMinutes
                            ? new Date(Date.now() + input.durationMinutes * 60 * 1000)
                            : null
                    }
                })
            ]);

            // Emit banned event
            sessionEventEmitter.emit('userBanned', {
                sessionId: input.sessionId,
                user: {
                    id: targetMember.user.id,
                    username: targetMember.user.username,
                    email: targetMember.user.email,
                    imageUrl: targetMember.user.imageUrl,
                    role: targetMember.role
                },
                action: ModerationActionType.BAN,
                reason: input.reason,
                durationMinutes: input.durationMinutes,
                moderator: {
                    id: moderator.user.id,
                    username: moderator.user.username
                }
            });

            return { success: true };
        }),

    // Kick user (Moderator only)
    kickUser: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            targetUserId: z.string(),
            reason: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify moderator status
            const moderator = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    role: { in: [UserRole.MODERATOR, UserRole.EVALUATOR] },
                    leftAt: null
                },
                include: {
                    user: true
                }
            });

            if (!moderator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only moderators can kick users",
                });
            }

            // Get target user info
            const targetMember = await prisma.sessionMember.findFirst({
                where: {
                    userId: input.targetUserId,
                    sessionId: input.sessionId,
                    leftAt: null
                },
                include: {
                    user: true
                }
            });

            if (!targetMember) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found in this session",
                });
            }

            // Can't kick other moderators unless you're the creator
            if (targetMember.role === UserRole.MODERATOR &&
                moderator.role !== UserRole.MODERATOR) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only session creator can kick other moderators",
                });
            }

            // Kick the target user
            await prisma.$transaction([
                prisma.sessionMember.update({
                    where: { id: targetMember.id },
                    data: {
                        leftAt: new Date(),
                    },
                }),
                prisma.moderationAction.create({
                    data: {
                        actionType: ModerationActionType.KICK,
                        reason: input.reason,
                        userId: targetMember.userId,
                        moderatorId: userId,
                        sessionId: input.sessionId,
                        sessionMemberId: targetMember.id
                    }
                })
            ]);

            // Emit kicked event
            sessionEventEmitter.emit('userKicked', {
                sessionId: input.sessionId,
                user: {
                    id: targetMember.user.id,
                    username: targetMember.user.username,
                    email: targetMember.user.email,
                    imageUrl: targetMember.user.imageUrl,
                    role: targetMember.role
                },
                action: ModerationActionType.KICK,
                reason: input.reason,
                moderator: {
                    id: moderator.user.id,
                    username: moderator.user.username
                }
            });

            return { success: true };
        }),

    // Mute user (Moderator only)
    muteUser: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            targetUserId: z.string(),
            reason: z.string().optional(),
            durationMinutes: z.number().min(1).max(1440) // 1 min to 24 hours
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify moderator status
            const moderator = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    role: { in: [UserRole.MODERATOR, UserRole.EVALUATOR] },
                    leftAt: null
                },
                include: {
                    user: true
                }
            });

            if (!moderator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only moderators can mute users",
                });
            }

            // Get target user info
            const targetMember = await prisma.sessionMember.findFirst({
                where: {
                    userId: input.targetUserId,
                    sessionId: input.sessionId,
                    leftAt: null
                },
                include: {
                    user: true
                }
            });

            if (!targetMember) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found in this session",
                });
            }

            // Can't mute other moderators unless you're the creator
            if (targetMember.role === UserRole.MODERATOR &&
                moderator.role !== UserRole.MODERATOR) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only session creator can mute other moderators",
                });
            }

            // Mute the target user
            await prisma.$transaction([
                prisma.sessionMember.update({
                    where: { id: targetMember.id },
                    data: {
                        isMuted: true,
                    },
                }),
                prisma.moderationAction.create({
                    data: {
                        actionType: ModerationActionType.MUTE,
                        reason: input.reason,
                        durationMinutes: input.durationMinutes,
                        userId: targetMember.userId,
                        moderatorId: userId,
                        sessionId: input.sessionId,
                        sessionMemberId: targetMember.id,
                        expiresAt: new Date(Date.now() + input.durationMinutes * 60 * 1000)
                    }
                })
            ]);

            // Emit muted event
            sessionEventEmitter.emit('userMuted', {
                sessionId: input.sessionId,
                user: {
                    id: targetMember.user.id,
                    username: targetMember.user.username,
                    email: targetMember.user.email,
                    imageUrl: targetMember.user.imageUrl,
                    role: targetMember.role
                },
                action: ModerationActionType.MUTE,
                reason: input.reason,
                durationMinutes: input.durationMinutes,
                moderator: {
                    id: moderator.user.id,
                    username: moderator.user.username
                }
            });

            return { success: true };
        }),

    // Unmute user (Moderator only)
    unmuteUser: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            targetUserId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify moderator status
            const moderator = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    role: { in: [UserRole.MODERATOR, UserRole.EVALUATOR] },
                    leftAt: null
                }
            });

            if (!moderator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only moderators can unmute users",
                });
            }

            // Get target user info
            const targetMember = await prisma.sessionMember.findFirst({
                where: {
                    userId: input.targetUserId,
                    sessionId: input.sessionId,
                    leftAt: null
                }
            });

            if (!targetMember) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found in this session",
                });
            }

            // Unmute the target user
            await prisma.sessionMember.update({
                where: { id: targetMember.id },
                data: {
                    isMuted: false,
                },
            });

            return { success: true };
        }),

    // Change user role (Moderator only)
    changeRole: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            targetUserId: z.string(),
            newRole: z.nativeEnum(UserRole)
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify moderator status
            const moderator = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    role: UserRole.MODERATOR, // Only main moderators can change roles
                    leftAt: null
                },
                include: {
                    user: true
                }
            });

            if (!moderator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only session moderators can change roles",
                });
            }

            // Get target user info
            const targetMember = await prisma.sessionMember.findFirst({
                where: {
                    userId: input.targetUserId,
                    sessionId: input.sessionId,
                    leftAt: null
                },
                include: {
                    user: true,
                    session: true
                    
                }
            });

            if (!targetMember) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found in this session",
                });
            }

            // Can't change role of other moderators unless you're the creator
            if (targetMember.role === UserRole.MODERATOR &&
                moderator.userId !== targetMember.session.creatorId) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only session creator can change moderator roles",
                });
            }

            const oldRole = targetMember.role;

            // Update the role
            await prisma.sessionMember.update({
                where: { id: targetMember.id },
                data: {
                    role: input.newRole,
                },
            });

            // Emit role changed event
            sessionEventEmitter.emit('roleChanged', {
                sessionId: input.sessionId,
                userId: targetMember.userId,
                oldRole,
                newRole: input.newRole,
                changedBy: {
                    id: moderator.user.id,
                    username: moderator.user.username
                }
            });

            return { success: true };
        }),

    // Get session by ID
    getById: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const session = await prisma.session.findUnique({
                where: { id: input.id },
                include: {
                    creator: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            imageUrl: true
                        }
                    },
                    sessionMembers: {
                        // where: { leftAt: null, isBanned: false },  they can still visit the session page but cant see the chat
                        include: {
                            user: true
                        }
                    },
                    messages: {
                        take: 50,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    username: true,
                                    imageUrl: true
                                }
                            }
                        }
                    }
                },
            });

            if (!session) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Session not found",
                });
            }

            return session;
        }),

    // Get user's active sessions
    getMySessions: authedProcedure.query(async ({ ctx }) => {
        const userId = ctx.user.id;

        return await prisma.session.findMany({
            where: {
                sessionMembers: {
                    some: {
                        userId,
                        leftAt: null,
                        isBanned: false,
                    },
                },
                isActive: true
            },
            include: {
                creator: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
                _count: {
                    select: {
                        sessionMembers: {
                            where: { leftAt: null }
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }),

    // End a session (Moderator only)
    endSession: authedProcedure
        .input(z.object({ sessionId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify moderator status
            const moderator = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    role: UserRole.MODERATOR,
                    leftAt: null
                },
            });

            if (!moderator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only moderators can end sessions",
                });
            }

            // End the session
            await prisma.session.update({
                where: { id: input.sessionId },
                data: { isActive: false }
            });

            // Emit session ended event
            sessionEventEmitter.emit('sessionEnded', { sessionId: input.sessionId });

            return { success: true };
        }),

    // Update session settings (Moderator only)
    updateSession: authedProcedure
        .input(z.object({
            sessionId: z.string(),
            title: z.string().min(3).max(100).optional(),
            description: z.string().optional(),
            communicationModes: z.array(z.nativeEnum(CommunicationMode)).min(1).optional(),
            isPrivate: z.boolean().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify moderator status
            const moderator = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    role: UserRole.MODERATOR,
                    leftAt: null
                },
            });

            if (!moderator) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only moderators can update session settings",
                });
            }

            // Update the session
            await prisma.session.update({
                where: { id: input.sessionId },
                data: {
                    title: input.title,
                    description: input.description,
                    communicationModes: input.communicationModes,
                    // isPrivate: input.isPrivate
                }
            });

            // Emit session updated event
            sessionEventEmitter.emit('sessionUpdated', { sessionId: input.sessionId });

            return { success: true };
        }),

    // Get active members
    getActiveMembers: authedProcedure
        .input(z.object({ sessionId: z.string() }))
        .query(async ({ input }) => {
            return await prisma.sessionMember.findMany({
                where: {
                    sessionId: input.sessionId,
                    leftAt: null,
                    isBanned: false
                },
                include: {
                    user: true
                },
                orderBy: {
                    joinedAt: 'asc'
                }
            });
        }),

    // Get moderation history for a session
    getModerationHistory: authedProcedure
        .input(z.object({ sessionId: z.string() }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Verify user is a member of the session
            const member = await prisma.sessionMember.findFirst({
                where: {
                    userId,
                    sessionId: input.sessionId,
                    leftAt: null
                }
            });

            if (!member) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not a member of this session",
                });
            }

            return await prisma.moderationAction.findMany({
                where: {
                    sessionId: input.sessionId
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            imageUrl: true
                        }
                    },
                    moderator: {
                        select: {
                            id: true,
                            username: true,
                            imageUrl: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 50
            });
        }),

    // ========== SUBSCRIPTIONS ========== //

    // Subscribe to user join events
    onUserJoin: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<SessionEvent>((emit) => {
                const onJoin = (data: SessionEvent) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('userJoined', onJoin);
                return () => {
                    sessionEventEmitter.off('userJoined', onJoin);
                };
            });
        }),

    // Subscribe to user leave events
    onUserLeave: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<SessionEvent>((emit) => {
                const onLeave = (data: SessionEvent) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('userLeft', onLeave);
                return () => {
                    sessionEventEmitter.off('userLeft', onLeave);
                };
            });
        }),

    // Subscribe to user banned events
    onUserBanned: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<ModerationEvent>((emit) => {
                const onBanned = (data: ModerationEvent) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('userBanned', onBanned);
                return () => {
                    sessionEventEmitter.off('userBanned', onBanned);
                };
            });
        }),

    // Subscribe to user kicked events
    onUserKicked: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<ModerationEvent>((emit) => {
                const onKicked = (data: ModerationEvent) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('userKicked', onKicked);
                return () => {
                    sessionEventEmitter.off('userKicked', onKicked);
                };
            });
        }),

    // Subscribe to user muted events
    onUserMuted: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<ModerationEvent>((emit) => {
                const onMuted = (data: ModerationEvent) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('userMuted', onMuted);
                return () => {
                    sessionEventEmitter.off('userMuted', onMuted);
                };
            });
        }),

    // Subscribe to session ended events
    onSessionEnded: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<{ sessionId: string }>((emit) => {
                const onEnded = (data: { sessionId: string }) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('sessionEnded', onEnded);
                return () => {
                    sessionEventEmitter.off('sessionEnded', onEnded);
                };
            });
        }),

    // Subscribe to session updated events
    onSessionUpdated: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<{ sessionId: string }>((emit) => {
                const onUpdated = (data: { sessionId: string }) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('sessionUpdated', onUpdated);
                return () => {
                    sessionEventEmitter.off('sessionUpdated', onUpdated);
                };
            });
        }),

    // Subscribe to role change events
    onRoleChanged: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .subscription(({ input }) => {
            return observable<RoleChangeEvent>((emit) => {
                const onRoleChange = (data: RoleChangeEvent) => {
                    if (data.sessionId === input.sessionId) {
                        emit.next(data);
                    }
                };

                sessionEventEmitter.on('roleChanged', onRoleChange);
                return () => {
                    sessionEventEmitter.off('roleChanged', onRoleChange);
                };
            });
        }),
});