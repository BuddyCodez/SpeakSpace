"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Loader2, MoreVertical, LogOut, Users, PhoneCallIcon, VideoIcon, Volume1Icon } from 'lucide-react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { UserRole, type Session, type SessionMember, type User } from "@prisma/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { MessageInput } from "@/components/message/message-input"
import { TypingIndicator } from "@/components/message/typing-indicator"
import { ChatWelcome, MessageBubble } from "@/components/message/message-bubble"
import type { MessageStatus } from "@/components/message/message-status"

import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { trpc } from "@/utils/trpc"
import type { MessageWithSender } from "@/server/routers/message"
import { Dialog } from "@/components/ui/dialog"
import { MediaRoom } from "@/components/session-media/media-room"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type SessionWithMembers = Session & {
  sessionMembers: (SessionMember & {
    user: User
  })[]
  creator: User
}

// Track message status
type MessageStatusMap = Record<string, MessageStatus>

export default function SessionPage() {
  const params = useParams()
  const { toast } = useToast()
  const router = useRouter()
  const { data: session } = useSession()
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [messageStatus, setMessageStatus] = useState<MessageStatusMap>({})
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionId = params.id as string
  const [initialMessagesData, setInitialMessagesData] = useState<
    { messages: MessageWithSender[]; nextCursor: string | undefined } | undefined
  >(undefined)
  const [call, setCall] = useState(false)

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
  } = trpc.session.getById.useQuery({ id: sessionId }, { refetchOnWindowFocus: false })

  const currentUser = session?.user // authed session user
  const chatSession = sessionData as SessionWithMembers | undefined
  const currentSessionUser = sessionData?.sessionMembers.find(member => member.userId === currentUser?.id);
  if (currentSessionUser?.isBanned || currentSessionUser?.leftAt) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">You have been {currentSessionUser.isBanned ? "banned" : "kicked"} from this session</h1>
        <Button className="mt-4" onClick={() => router.push("/dashboard")}>
          Go back to sessions
        </Button>
      </div>
    )
  }
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
    { sessionId, limit: 50 },
    { enabled: !!chatSession },
  );
  const sendMessageMutation = trpc.message.send.useMutation({
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Your message has been sent",
      })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as any).message,
        variant: "destructive",
      })
    },
  });
  // Fetch initial messages regardless of chatSession, but only process if chatSession is available
  const initialMessagesQuery = trpc.message.getSessionMessages.useQuery(
    { sessionId, limit: 50 },
    { enabled: true }, // Always enabled to satisfy hook rules
  )

  useEffect(() => {
    if (chatSession && initialMessagesQuery.data) {
      setInitialMessagesData(initialMessagesQuery.data)
    }
  }, [chatSession, initialMessagesQuery.data])

  useEffect(() => {
    if (initialMessages) {
      setInitialMessagesData(initialMessages)
    }
  }, [initialMessages])

  useEffect(() => {
    if (initialMessagesData) {
      setMessages(initialMessagesData.messages)

      // Set all server messages as "delivered"
      const statusMap: MessageStatusMap = {}
      initialMessagesData.messages.forEach(msg => {
        if (msg.senderId === currentUser?.id) {
          statusMap[msg.id] = "delivered"
        }
      })
      setMessageStatus(prev => ({ ...prev, ...statusMap }))

      setNextCursor(initialMessagesData.nextCursor)
      scrollToBottom("auto")
    }
  }, [initialMessagesData, currentUser?.id])

  // Subscribe to new messages
  trpc.message.onNewMessage.useSubscription(
    { sessionId },
    {
      onData: (newMessage) => {
        setMessages((prev: any) => {
          // Check if we already have this message or a temporary version of it
          const existingMsgIndex = prev.findIndex(
            (msg: any) =>
              msg.id === newMessage.id ||
              (msg.id.startsWith("temp-") &&
                msg.content === newMessage.content &&
                msg.senderId === newMessage.senderId),
          )

          if (existingMsgIndex >= 0) {
            // Replace the temporary message with the real one
            const updatedMessages = [...prev]
            updatedMessages[existingMsgIndex] = newMessage

            // Update message status
            if (newMessage.senderId === currentUser?.id) {
              setMessageStatus(prev => ({
                ...prev,
                [newMessage.id]: "delivered"
              }))

              // If there was a temp message, remove its status
              const tempMsg = updatedMessages[existingMsgIndex]
              if (tempMsg.id.startsWith("temp-")) {
                setMessageStatus(prev => {
                  const newStatus = { ...prev }
                  delete newStatus[tempMsg.id]
                  return newStatus
                })
              }
            }

            return updatedMessages
          } else {
            // It's a new message
            // If it's from current user, set status to delivered
            if (newMessage.senderId === currentUser?.id) {
              setMessageStatus(prev => ({
                ...prev,
                [newMessage.id]: "delivered"
              }))
            }
            return [...prev, newMessage]
          }
        })
        scrollToBottom()
      },
    },
  )

  // Subscribe to session events
  trpc.session.onUserJoin.useSubscription(
    { sessionId },
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
    { sessionId },
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
    { sessionId },
    {
      onData: (data) => {
        toast({
          title: "User Banned",
          description: `${data.user.username} has been banned from the session`,
          variant: "destructive",
        })
        // create a system message for the user that was banned
        sendMessageMutation.mutateAsync({
          sessionId,
          content: `${data.user.username} has been banned from the session`,

        }).catch((error) => {
          toast({
            title: "Error",
            description: (error as any).message,
            variant: "destructive",
          })
        })
        data.user.id === currentUser?.id && router.push("/dashboard");
      },
    },
  )

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
        sessionId,
        limit: 50,
        cursor: nextCursor,
      })

      if ((response?.data?.messages?.length ?? 0) > 0) {
        setMessages((prev) => [...(response?.data?.messages ?? []), ...prev])

        // Set all server messages from current user as "delivered"
        const statusMap: MessageStatusMap = {}
        response?.data?.messages.forEach(msg => {
          if (msg.senderId === currentUser?.id) {
            statusMap[msg.id] = "delivered"
          }
        })
        setMessageStatus(prev => ({ ...prev, ...statusMap }))

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

  // Leave session handler
  const handleLeaveSession = () => {
    leaveSessionMutation.mutate({ sessionId })
  }

  // Ban user handler
  const handleBanUser = (userId: string) => {
    banUserMutation.mutate({
      sessionId,
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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4 bg-background shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">
              {chatSession.title}
              {"'s Session"}
            </h1>
            <p className="text-sm text-zinc-400">Created by {chatSession.creator?.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  onClick={() => {
                  
                  }}
                >
                  <VideoIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-800 text-white">
                <p className="text-sm">Start a video call</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                >
                  <Volume1Icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-800 text-white">
                <p className="text-sm">Start a voice call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
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
                variant="secondary"
                size="icon"
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
      {/* {<MediaRoom
        sessionId={sessionId}
        roomName={chatSession.title}
        username={currentUser?.name || ""}
        video={true}
        audio={true}
      />} */}
      <ScrollArea className="flex-1 p-4">
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
        <ChatWelcome name={chatSession.title} />
        <div className="space-y-6">
          {groupedMessages.map((messageGroup, i) => (
            <div key={i} className="space-y-1">
              {messageGroup.map((message, j) => {
                const isCurrentUser = message.sender.id === currentUser?.id

                // Determine message status
                let status: MessageStatus = "sent"
                if (isCurrentUser) {
                  if (message.id.startsWith("temp-")) {
                    status = messageStatus[message.id] || "sending"
                  } else {
                    status = messageStatus[message.id] || "sent"
                  }
                }

                return (
                  <MessageBubble
                    key={message.id}
                    id={message.id}
                    content={message.content}
                    mediaUrl={message.mediaUrl}
                    mediaType={message.mediaType}
                    sender={message.sender}
                    createdAt={message.createdAt}
                    isCurrentUser={isCurrentUser}
                    status={status}
                    currentUser={{
                      id: currentUser?.id || "",
                      username: currentUser?.name || "",
                      imageUrl: currentUser?.image || null,
                    }}
                  />
                )
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Typing Indicator */}
      <TypingIndicator sessionId={sessionId} />

      {/* Message Input */}
      <MessageInput
        sessionId={sessionId}
        onMessageSent={(optimisticMessage) => {
          if (optimisticMessage) {
            // Add optimistic message immediately to the UI
            setMessages((prev) => [...prev, optimisticMessage])

            // Set status to sending
            setMessageStatus(prev => ({
              ...prev,
              [optimisticMessage.id]: "sending"
            }))

            // After a short delay, update to sent (simulating network)
            setTimeout(() => {
              setMessageStatus(prev => ({
                ...prev,
                [optimisticMessage.id]: "sent"
              }))
            }, 500)

            scrollToBottom()
          } else {
            scrollToBottom()
          }
        }}
      />
    </div>
  )
}
