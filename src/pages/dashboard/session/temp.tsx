"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Loader2, Send, MoreVertical, Paperclip, LogOut, Users } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { UserRole, type Session, type SessionMember, type User } from "@prisma/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { trpc } from "@/utils/trpc"

type MessageWithSender = {
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

type SessionWithMembers = Session & {
    sessionMembers: (SessionMember & {
        user: User
    })[]
    creator: User
}

export default function SessionPage() {
    const params = useParams()
    const { toast } = useToast()
    const router = useRouter()
    const { data: session } = useSession()
    const [messageText, setMessageText] = useState("")
    const [messages, setMessages] = useState<MessageWithSender[]>([])
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Add these new state variables at the top of the component with the other state declarations
    const [messageCount, setMessageCount] = useState(0)
    const [cooldownActive, setCooldownActive] = useState(false)
    const [cooldownRemaining, setCooldownRemaining] = useState(0)
    const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null)
    const lastMessageTimestampsRef = useRef<number[]>([])

    // Add these constants near the top of the component
    const MESSAGE_LIMIT = 5 // Maximum messages allowed in the time window
    const TIME_WINDOW = 10 // Time window in seconds
    const COOLDOWN_DURATION = 5 // Cooldown duration in seconds

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior })
        }, 100)
    }

    // Get session data
    const {
        data: sessionData,
        isLoading: sessionLoading,
        error: sessionError,
    } = trpc.session.getById.useQuery({ id: params.id as string }, { refetchOnWindowFocus: false })

    const currentUser = session?.user
    const chatSession = sessionData as SessionWithMembers | undefined

    useEffect(() => {
        if (sessionError) {
            toast({
                title: "Error",
                description: (sessionError as any).message,
                variant: "destructive",
            })
            router.push("/dashboard")
        }
    }, [sessionError, toast, router])

    // Get initial messages
    const { data: initialMessages, isLoading: messagesLoading } = trpc.message.getSessionMessages.useQuery(
        { sessionId: params.id as string, limit: 50 },
        { enabled: !!chatSession },
    )

    useEffect(() => {
        if (initialMessages) {
            setMessages(initialMessages.messages)
            setNextCursor(initialMessages.nextCursor)
            scrollToBottom("auto")
        }
    }, [initialMessages])

    // Subscribe to new messages
    trpc.message.onNewMessage.useSubscription(
        { sessionId: params.id as string },
        {
            onData: (newMessage) => {
                setMessages((prev) => {
                    // Check if we already have this message or a temporary version of it
                    const existingMsgIndex = prev.findIndex(
                        (msg) =>
                            msg.id === newMessage.id ||
                            (msg.id.startsWith("temp-") &&
                                msg.content === newMessage.content &&
                                msg.senderId === newMessage.senderId),
                    )

                    if (existingMsgIndex >= 0) {
                        // Replace the temporary message with the real one
                        const updatedMessages = [...prev]
                        updatedMessages[existingMsgIndex] = newMessage
                        return updatedMessages
                    } else {
                        // It's a new message
                        return [...prev, newMessage]
                    }
                })
                scrollToBottom()
            },
        },
    )

    // Subscribe to session events
    trpc.session.onUserJoin.useSubscription(
        { sessionId: params.id as string },
        {
            onData: (data) => {
                toast({
                    title: "User Joined",
                    description: `${data.user.username} has joined the session`,
                })
            },
        },
    )

    trpc.session.onUserLeave.useSubscription(
        { sessionId: params.id as string },
        {
            onData: (data) => {
                toast({
                    title: "User Left",
                    description: `${data.user.username} has left the session`,
                })
            },
        },
    )

    trpc.session.onUserBanned.useSubscription(
        { sessionId: params.id as string },
        {
            onData: (data) => {
                toast({
                    title: "User Banned",
                    description: `${data.user.username} has been banned from the session`,
                    variant: "destructive",
                })
            },
        },
    )

    // Send message mutation
    const sendMessageMutation = trpc.message.send.useMutation({
        onSuccess: (newMessage) => {
            setMessageText("")
            setIsSending(false)
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            })
            setIsSending(false)
        },
    })

    // Leave session mutation
    const leaveSessionMutation = trpc.session.leave.useMutation({
        onSuccess: () => {
            toast({
                title: "Left Session",
                description: "You have left the session",
            })
            router.push("/dashboard/session")
        },
    })

    // Ban user mutation
    const banUserMutation = trpc.session.banUser.useMutation({
        onSuccess: () => {
            toast({
                title: "User Banned",
                description: "The user has been banned from this session",
            })
        },
    })

    // Load more messages
    const loadMoreMessages = async () => {
        if (!nextCursor || isLoadingMore) return

        setIsLoadingMore(true)
        try {
            const response = await trpc.message.getSessionMessages.useQuery({
                sessionId: params.id as string,
                limit: 50,
                cursor: nextCursor,
            })

            if ((response?.data?.messages?.length ?? 0) > 0) {
                setMessages((prev) => [...(response?.data?.messages ?? []), ...prev])
                setNextCursor(response?.data?.nextCursor)
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to load more messages",
                variant: "destructive",
            })
        } finally {
            setIsLoadingMore(false)
        }
    }

    // Handle file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsSending(true)
        const reader = new FileReader()
        reader.onload = async (event) => {
            if (event.target?.result) {
                const fileData = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: event.target.result.toString().split(",")[1],
                }

                sendMessageMutation.mutate({
                    sessionId: params.id as string,
                    mediaFile: fileData,
                    mediaType: file.type,
                })
            }
        }
        reader.readAsDataURL(file)
    }

    // Add this function after the other utility functions but before the handlers
    const checkRateLimit = (): boolean => {
        const now = Date.now()

        // Remove timestamps older than the time window
        const timeWindow = TIME_WINDOW * 1000 // convert to milliseconds
        lastMessageTimestampsRef.current = lastMessageTimestampsRef.current.filter(
            (timestamp) => now - timestamp < timeWindow,
        )

        // If we're in cooldown, prevent sending
        if (cooldownActive) {
            return false
        }

        // Check if we've hit the message limit
        if (lastMessageTimestampsRef.current.length >= MESSAGE_LIMIT) {
            // Activate cooldown
            setCooldownActive(true)
            setCooldownRemaining(COOLDOWN_DURATION)

            // Start cooldown timer
            if (cooldownTimerRef.current) {
                clearInterval(cooldownTimerRef.current)
            }

            cooldownTimerRef.current = setInterval(() => {
                setCooldownRemaining((prev) => {
                    if (prev <= 1) {
                        // End cooldown
                        setCooldownActive(false)
                        if (cooldownTimerRef.current) {
                            clearInterval(cooldownTimerRef.current)
                            cooldownTimerRef.current = null
                        }
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)

            toast({
                title: "Slow down!",
                description: `You're sending messages too quickly. Please wait ${COOLDOWN_DURATION} seconds.`,
                variant: "warning",
            })

            return false
        }

        // Add current timestamp to the list
        lastMessageTimestampsRef.current.push(now)
        return true
    }

    // Add cleanup for the timer in useEffect
    useEffect(() => {
        return () => {
            if (cooldownTimerRef.current) {
                clearInterval(cooldownTimerRef.current)
            }
        }
    }, [])

    // Replace the handleSendMessage function with this updated version
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!messageText.trim() || isSending) return

        // Check rate limit before sending
        if (!checkRateLimit()) {
            return
        }

        setIsSending(true)
        const tempId = `temp-${Date.now()}`
        const tempMessage = messageText.trim()

        // Add optimistic message
        const optimisticMessage: MessageWithSender = {
            id: tempId,
            content: tempMessage,
            mediaUrl: null,
            mediaType: null,
            senderId: currentUser?.id || "",
            sessionId: params.id as string,
            createdAt: new Date(),
            sender: {
                id: currentUser?.id || "",
                username: currentUser?.name || "You",
                imageUrl: currentUser?.image || null,
            },
        }

        setMessages((prev) => [...prev, optimisticMessage])
        setMessageText("")
        scrollToBottom()

        try {
            await sendMessageMutation.mutateAsync({
                sessionId: params.id as string,
                content: tempMessage,
            })
            // We don't need to add the message here as it will come through the subscription
        } catch (error) {
            // If there's an error, remove the optimistic message
            setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
            setMessageText(tempMessage) // Restore the message text so user can try again
            toast({
                title: "Failed to send message",
                description: "Please try again",
                variant: "destructive",
            })
        } finally {
            setIsSending(false)
        }
    }

    // Leave session handler
    const handleLeaveSession = () => {
        leaveSessionMutation.mutate({ sessionId: params.id as string })
    }

    // Ban user handler
    const handleBanUser = (userId: string) => {
        banUserMutation.mutate({
            sessionId: params.id as string,
            targetUserId: userId,
        })
    }

    if (sessionLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!chatSession) {
        return (
            <div className="flex h-screen flex-col items-center justify-center">
                <h1 className="text-2xl font-bold">Session not found</h1>
                <Button className="mt-4" onClick={() => router.push("/dashboard/session")}>
                    Go back to sessions
                </Button>
            </div>
        )
    }

    // Group messages by sender for better UI
    const groupedMessages = messages.reduce((groups, message) => {
        const lastGroup = groups[groups.length - 1]
        if (lastGroup && lastGroup[0].sender.id === message.sender.id) {
            lastGroup.push(message)
        } else {
            groups.push([message])
        }
        return groups
    }, [] as MessageWithSender[][])

    // Fetch initial messages outside the main render flow to avoid conditional hook call

    const { data: initialMessagesData, isLoading: initialMessagesLoading } = trpc.message.getSessionMessages.useQuery(
        { sessionId: params.id as string, limit: 50 },
        { enabled: !!chatSession },
    )

    return (
        <div className="flex h-screen flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4 bg-white shadow-sm">
                <div className="flex items-center gap-3">
                    <Avatar className="border-2 border-blue-100">
                        <AvatarImage src={chatSession.creator?.imageUrl || undefined} />
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                            {chatSession.creator?.username?.charAt(0) || "U"}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">
                            {chatSession.title}
                            {"'s Session"}
                        </h1>
                        <p className="text-sm text-gray-500">Created by {chatSession.creator?.username}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="border-gray-200 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                                <Users className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle className="text-blue-600">Session Members</SheetTitle>
                            </SheetHeader>
                            <div className="mt-6 space-y-4">
                                {chatSession?.sessionMembers?.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="border border-gray-100">
                                                <AvatarImage src={member?.user?.imageUrl || ""} />
                                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                                    {member?.user?.username?.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-gray-800">{member?.user?.username}</p>
                                                    {member.role === UserRole.MODERATOR && (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                                                            Moderator
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                                                </p>
                                            </div>
                                        </div>
                                        {currentUser?.id === chatSession.creator?.id && member.role !== UserRole.MODERATOR && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-blue-600">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => handleBanUser(member.userId)}
                                                        className="text-red-500 focus:text-red-500 focus:bg-red-50"
                                                    >
                                                        Ban User
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="border-gray-200 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={handleLeaveSession}
                                className="text-red-500 focus:text-red-500 focus:bg-red-50"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Leave Session
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-[#f8fafc]">
                {isLoadingMore && (
                    <div className="flex justify-center py-2">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                )}
                {nextCursor && (
                    <div className="flex justify-center py-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadMoreMessages}
                            disabled={isLoadingMore}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                            {isLoadingMore ? "Loading..." : "Load more messages"}
                        </Button>
                    </div>
                )}
                <div className="space-y-4">
                    {groupedMessages.map((messageGroup, i) => (
                        <div
                            key={i}
                            className={`flex ${messageGroup[0].sender.id === currentUser?.id ? "justify-end" : "justify-start"}`}
                        >
                            <div className={`max-w-[70%] space-y-1`}>
                                {messageGroup.map((message, j) => (
                                    <div
                                        key={message.id}
                                        className={`overflow-hidden rounded-lg p-3 ${message.sender.id === currentUser?.id
                                            ? "bg-blue-500 text-white shadow-sm"
                                            : "bg-white border border-gray-100 shadow-sm"
                                            } ${message.id.startsWith("temp-") ? "opacity-70" : "opacity-100"}`}
                                    >
                                        {message.sender.id !== currentUser?.id && j === 0 && (
                                            <div className="mb-1 flex items-center gap-2">
                                                <Avatar className="h-6 w-6 border border-gray-100">
                                                    <AvatarImage src={message.sender.imageUrl || undefined} />
                                                    <AvatarFallback className="bg-blue-100 text-blue-600">
                                                        {message.sender.username.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <p className="text-xs font-medium text-gray-700">{message.sender.username}</p>
                                            </div>
                                        )}
                                        {message.content && (
                                            <p className={message.sender.id === currentUser?.id ? "text-white" : "text-gray-800"}>
                                                {message.content}
                                            </p>
                                        )}
                                        {message.mediaUrl && (
                                            <div className="mt-2">
                                                {message.mediaType?.startsWith("image/") ? (
                                                    <img
                                                        src={message.mediaUrl || "/placeholder.svg"}
                                                        alt="Shared image"
                                                        className="max-h-60 rounded-md object-contain border border-gray-100"
                                                    />
                                                ) : message.mediaType?.startsWith("video/") ? (
                                                    <video
                                                        src={message.mediaUrl}
                                                        controls
                                                        className="max-h-60 rounded-md border border-gray-100"
                                                    />
                                                ) : (
                                                    <a
                                                        href={message.mediaUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 rounded-md bg-white/90 p-2 text-sm text-blue-600 border border-gray-100"
                                                    >
                                                        <Paperclip className="h-4 w-4" />
                                                        Download file
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        <p
                                            className={`mt-1 text-right text-xs ${message.sender.id === currentUser?.id ? "text-blue-100" : "text-gray-500"}`}
                                        >
                                            {format(new Date(message.createdAt), "HH:mm")}
                                            {message.id.startsWith("temp-") && <span className="ml-1">• Sending</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t p-4 bg-white">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || cooldownActive}
                    className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                >
                    <Paperclip className="h-5 w-5" />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isSending || cooldownActive}
                    />
                </Button>
                <div className="flex-1 relative">
                    <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder={cooldownActive ? `Cooldown: ${cooldownRemaining}s remaining...` : "Type your message..."}
                        className={`flex-1 border-gray-200 focus-visible:ring-blue-400 ${cooldownActive ? "pr-[90px]" : ""}`}
                        disabled={isSending || cooldownActive}
                    />
                    {cooldownActive && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-100 text-blue-600 text-xs font-medium px-2 py-1 rounded-full">
                            {cooldownRemaining}s
                        </div>
                    )}
                </div>
                <Button
                    type="submit"
                    size="icon"
                    disabled={!messageText.trim() || isSending || cooldownActive}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
            </form>
        </div>
    )
}
