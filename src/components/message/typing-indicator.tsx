"use client"

import { motion } from "framer-motion"
import { trpc } from "@/utils/trpc"
import { useSession } from "next-auth/react"

interface TypingIndicatorProps {
    sessionId: string
}

export function TypingIndicator({ sessionId }: TypingIndicatorProps) {
    const { data: session } = useSession()
    const currentUserId = session?.user?.id

    // Subscribe to typing indicators
    const { data: typingUsers } = trpc.message.whoIsTyping.useSubscription(
        { sessionId },
        {
            // Refetch on reconnect to ensure we have the latest dat
            
        }
    )

    // Filter out current user from typing indicators
    const otherTypingUsers = typingUsers?.filter(user => user.id !== currentUserId) || []

    if (otherTypingUsers.length === 0) {
        return null
    }

    return (
        <div className="px-4 py-1">
            <div className="flex items-center text-xs text-blue-600">
                <span className="font-medium mr-2">
                    {otherTypingUsers.length === 1
                        ? `${otherTypingUsers[0].username} is typing`
                        : `${otherTypingUsers.length} people are typing`}
                </span>
                <motion.div className="flex space-x-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-blue-500"
                            initial={{ opacity: 0.5, y: 0 }}
                            animate={{
                                opacity: [0.5, 1, 0.5],
                                y: ["0%", "-50%", "0%"]
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: "easeInOut"
                            }}
                        />
                    ))}
                </motion.div>
            </div>
        </div>
    )
}
