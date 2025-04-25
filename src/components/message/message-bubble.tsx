"use client"

import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HashIcon, Paperclip, ShieldUserIcon } from 'lucide-react'
import { MessageStatus, MessageStatus as MessageStatusType } from "./message-status"
import { cn } from "@/lib/utils"
import { Tooltip } from "../ui/tooltip"
import { stat } from "fs"

interface MessageBubbleProps {
    id: string
    content: string | null
    mediaUrl: string | null
    mediaType: string | null
    sender: {
        id: string
        username: string
        imageUrl: string | null
    }
    createdAt: Date
    isCurrentUser: boolean
    status: MessageStatusType
    currentUser: {
        id: string
        username: string
        imageUrl: string | null
    }
}
const DATE_FORMAT = "d MMM yyyy, HH:mm"
export function MessageBubble({
    id,
    content,
    mediaUrl,
    mediaType,
    sender,
    createdAt,
    isCurrentUser,
    status,
    currentUser
}: MessageBubbleProps) {
    const user = isCurrentUser ? currentUser : sender;
    return (
        <div className={cn("relative group flex items-center hover:bg-zinc-300/10 rounded-xl p-4 transition w-full opacity-100",
            (status === "sending") && "opacity-10",
            status === "error" && "text-red-500",

        )}>
            <div className="group flex gap-x-2 items-start w-full">
                <div className="cursor-pointer hover:drop-shadow-md transition">
                    {
                        mediaType === "system" ? (
                            <ShieldUserIcon className="h-12 w-12 text-white" />
                        ) : (
                            <Avatar>
                                <AvatarImage
                                    src={user.imageUrl ?? undefined}
                                    alt={user.username}
                                    className="h-10 w-10"
                                />
                                <AvatarFallback className="bg-blue-500 text-white">
                                    {user.username.charAt(0).toUpperCase() + user.username.charAt(1).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        )
                    }
                </div>
                <div className="flex flex-col w-full">
                    <div className="flex items-center gap-x-2">
                        <p className="font-semibold text-sm hover:underline cursor-pointer">
                            {mediaType === "system" ? "System" : user.username}
                        </p>
                        {/* TOOL TIP LATER. */}
                        <span className="text-sm text-zinc-500">
                            {format(new Date(createdAt), DATE_FORMAT)}
                        </span>
                        {status === "error" && <span className="text-red-500 text-sm">
                            (Error)
                        </span>}
                        {status === "sending" && <span className="text-zinc-500 text-sm">
                            (sending...)
                        </span>}
                    </div>
                    {content}
                </div>
            </div>
        </div>
    )
}



// welcome/
export const ChatWelcome = ({ name }: { name: string }) => {
    return (
        <div className="space-y-2 px-4 mb-4 ">
            <div className="h-[75px] w-[75px] rounded-full bg-zinc-500 flex items-center justify-center">
                <HashIcon className="h-12 w-12 text-white" />
            </div>
            <p className="text-xl md:text-3xl font-bold ">
                Welcome to the chat, {name}
            </p>
            <p className="text-zinc-400 text-sm">
                This is the beginning of your chat history. You can start a conversation with anyone in the chat.
            </p>
        </div>
    )
}

